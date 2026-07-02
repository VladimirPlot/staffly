package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAutoBuildPreviewService;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;
import ru.staffly.security.SecurityService;

import java.util.Collections;
import java.util.List;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleAutoBuildPreviewServiceImpl implements ScheduleAutoBuildPreviewService {
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleRepository schedules;
    private final ScheduleBuildTemplateRepository templates;
    private final ScheduleAutoBuildPlanner planner;

    @Override
    public ScheduleAutoBuildPreviewResponse preview(Long restaurantId, Long scheduleId, Long actorUserId, PreviewScheduleAutoBuildRequest request) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        validateRequest(request);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        if (schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Preview автосборки доступен только для статусов PREFERENCES_CLOSED или DRAFT_FROM_PREFERENCES");
        }

        ScheduleBuildTemplate template = resolveEffectiveTemplate(restaurantId, schedule, request.templateId());
        initializeTemplateCollections(template);

        Set<Long> templatePositions = template.getPositionConfigs().stream().map(pc -> pc.getPosition().getId()).collect(java.util.stream.Collectors.toSet());
        List<Long> schedulePositions = schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds();
        if (Collections.disjoint(templatePositions, schedulePositions)) {
            throw new BadRequestException("Шаблон не содержит конфигураций для позиций графика");
        }

        var plan = planner.build(restaurantId, schedule, template);
        return new ScheduleAutoBuildPreviewResponse(
                plan.scheduleId(),
                plan.templateId(),
                plan.templateId(),
                plan.templateName(),
                plan.positions().stream().map(this::toPositionDto).toList(),
                plan.warnings(),
                plan.uncoveredSlots().stream().map(this::toUncoveredSlotDto).toList(),
                plan.totalAssignments(),
                plan.warningsCount(),
                plan.unfilledCount(),
                plan.negativeAssignmentsCount()
        );
    }

    private ScheduleBuildTemplate resolveEffectiveTemplate(Long restaurantId, Schedule schedule, Long requestedTemplateId) {
        ScheduleBuildTemplate preferenceTemplate = schedule.getPreferenceBuildTemplate();
        if (preferenceTemplate != null) {
            Long preferenceTemplateId = preferenceTemplate.getId();
            if (requestedTemplateId != null && !preferenceTemplateId.equals(requestedTemplateId)) {
                throw new BadRequestException("Автосборка использует шаблон, выбранный при сборе пожеланий. Передан другой templateId: " + requestedTemplateId);
            }
            return templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(preferenceTemplateId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Active preference template not found: " + preferenceTemplateId));
        }

        return templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(requestedTemplateId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Active template not found: " + requestedTemplateId));
    }

    private void initializeTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig positionConfig : template.getPositionConfigs()) {
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
            Hibernate.initialize(positionConfig.getHeavyDaysOfWeek());
        }
    }

    private void validateRequest(PreviewScheduleAutoBuildRequest request) {
        if (request == null || request.templateId() == null) {
            throw new BadRequestException("templateId is required");
        }
    }

    private ScheduleAutoBuildPositionPreviewDto toPositionDto(ScheduleAutoBuildPlanner.PositionPlan plan) {
        return new ScheduleAutoBuildPositionPreviewDto(
                plan.positionId(),
                plan.positionName(),
                plan.cells().stream().map(this::toCellDto).toList(),
                plan.warnings(),
                plan.totalAssignments(),
                plan.warningsCount(),
                plan.unfilledCount(),
                plan.negativeAssignmentsCount()
        );
    }

    private ScheduleAutoBuildCellPreviewDto toCellDto(ScheduleAutoBuildPlanner.AssignmentPlan a) {
        return new ScheduleAutoBuildCellPreviewDto(
                a.memberId(),
                a.memberName(),
                a.day(),
                a.value(),
                a.shiftOptionId(),
                a.shiftLabel(),
                a.startTime(),
                a.endTime(),
                a.reason(),
                a.matchStatus(),
                a.warningMessage(),
                a.warnings()
        );
    }

    private ScheduleAutoBuildUncoveredSlotDto toUncoveredSlotDto(ScheduleAutoBuildPlanner.UncoveredSlotPlan slot) {
        return new ScheduleAutoBuildUncoveredSlotDto(
                slot.date(),
                slot.positionId(),
                slot.startTime(),
                slot.endTime(),
                slot.requiredCount(),
                slot.assignedCount()
        );
    }
}
