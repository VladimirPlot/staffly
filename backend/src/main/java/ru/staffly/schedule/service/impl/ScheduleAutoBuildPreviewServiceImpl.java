package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.Schedule;
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

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        if (schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Preview автосборки доступен только для статусов PREFERENCES_CLOSED или DRAFT_FROM_PREFERENCES");
        }

        ScheduleBuildTemplate template = templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(request.templateId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Active template not found: " + request.templateId()));

        Set<Long> templatePositions = template.getPositionConfigs().stream().map(pc -> pc.getPosition().getId()).collect(java.util.stream.Collectors.toSet());
        List<Long> schedulePositions = schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds();
        if (Collections.disjoint(templatePositions, schedulePositions)) {
            throw new BadRequestException("Шаблон не содержит конфигураций для позиций графика");
        }

        var plan = planner.build(restaurantId, schedule, template);
        return new ScheduleAutoBuildPreviewResponse(
                plan.scheduleId(),
                plan.templateId(),
                plan.templateName(),
                plan.positions().stream().map(this::toPositionDto).toList(),
                plan.warnings(),
                plan.totalAssignments(),
                plan.warningsCount(),
                plan.unfilledCount(),
                plan.negativeAssignmentsCount()
        );
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
        return new ScheduleAutoBuildCellPreviewDto(a.memberId(), a.memberName(), a.day(), a.value(), a.shiftOptionId(), a.shiftLabel(), a.reason(), a.warnings());
    }
}
