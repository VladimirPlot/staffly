package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.SchedulePositionIds;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAutoBuildPreviewService;
import ru.staffly.schedule.service.ScheduleAutoBuildFingerprintService;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;
import ru.staffly.security.SecurityService;

import java.util.Collections;
import java.util.List;
import java.util.Set;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.Map;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleAutoBuildPreviewServiceImpl implements ScheduleAutoBuildPreviewService {
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleRepository schedules;
    private final ScheduleBuildTemplateRepository templates;
    private final ScheduleAutoBuildPlanner planner;
    private final ScheduleAutoBuildFingerprintService fingerprintService;

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

        Set<Long> templatePositions = template.getPositionConfigs().stream().flatMap(pc -> configPositionIds(pc).stream()).collect(java.util.stream.Collectors.toSet());
        List<Long> schedulePositions = SchedulePositionIds.ids(schedule);
        if (Collections.disjoint(templatePositions, schedulePositions)) {
            throw new BadRequestException("Шаблон не содержит конфигураций для позиций графика");
        }

        String previewToken = fingerprintService.fingerprint(restaurantId, schedule, template);
        var plan = planner.build(restaurantId, schedule, template);
        String verifiedToken = fingerprintService.fingerprint(restaurantId, schedule, template);
        if (!previewToken.equals(verifiedToken)) {
            throw new ru.staffly.schedule.exception.ScheduleDomainConflictException(
                    "AUTO_BUILD_PREVIEW_STALE",
                    "Данные графика изменились во время построения предпросмотра. Постройте автосборку заново."
            );
        }
        boolean vocabularyChanged = hasShiftVocabularyChanged(schedule, template);
        List<String> warnings = new ArrayList<>(plan.warnings());
        if (vocabularyChanged) {
            warnings.add("Набор смен в шаблоне изменился после сбора пожеланий. Проверьте пожелания сотрудников перед применением автосборки.");
        }
        return new ScheduleAutoBuildPreviewResponse(
                plan.scheduleId(),
                plan.templateId(),
                plan.templateId(),
                previewToken,
                plan.templateName(),
                plan.positions().stream().map(this::toPositionDto).toList(),
                warnings,
                plan.uncoveredSlots().stream().map(this::toUncoveredSlotDto).toList(),
                plan.rejectionHints().stream().map(this::toRejectionHintDto).toList(),
                plan.totalAssignments(),
                plan.warningsCount() + (vocabularyChanged ? 1 : 0),
                plan.unfilledCount(),
                plan.negativeAssignmentsCount()
        );
    }

    private boolean hasShiftVocabularyChanged(Schedule schedule, ScheduleBuildTemplate template) {
        if (schedule.getPreferenceBuildTemplate() == null) {
            return false;
        }
        Map<ShiftVocabularyEntry, Long> snapshot = schedule.getPreferenceShiftOptionSnapshots().stream()
                .map(option -> new ShiftVocabularyEntry(new LinkedHashSet<>(option.getPositionIds()),
                        option.getStartTime(), option.getEndTime()))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        Set<Long> schedulePositionIds = new java.util.HashSet<>(SchedulePositionIds.ids(schedule));
        Map<ShiftVocabularyEntry, Long> live = template.getPositionConfigs().stream()
                .map(config -> new ScopedPositionConfig(config, configPositionIds(config).stream()
                        .filter(schedulePositionIds::contains)
                        .collect(Collectors.toCollection(LinkedHashSet::new))))
                .filter(scoped -> !scoped.positionIds().isEmpty())
                .flatMap(scoped -> scoped.config().getShiftOptions().stream().map(option ->
                        new ShiftVocabularyEntry(scoped.positionIds(), option.getStartTime(), option.getEndTime())))
                .collect(Collectors.groupingBy(Function.identity(), Collectors.counting()));
        return !snapshot.equals(live);
    }

    // Label and planner-only configuration are intentionally cosmetic/outside this vocabulary comparison.
    private record ShiftVocabularyEntry(Set<Long> positionIds, java.time.LocalTime startTime,
                                        java.time.LocalTime endTime) { }

    private record ScopedPositionConfig(ScheduleBuildPositionConfig config, Set<Long> positionIds) { }

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
            Hibernate.initialize(positionConfig.getPositions());
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
            Hibernate.initialize(positionConfig.getHeavyDaysOfWeek());
        }
    }

    private List<Long> configPositionIds(ScheduleBuildPositionConfig config) {
        return config.getPositions() == null ? List.of() : config.getPositions().stream().map(position -> position.getId())
                .filter(java.util.Objects::nonNull)
                .sorted()
                .toList();
    }

    private void validateRequest(PreviewScheduleAutoBuildRequest request) {
        if (request == null || request.templateId() == null) {
            throw new BadRequestException("templateId is required");
        }
    }

    private ScheduleAutoBuildPositionPreviewDto toPositionDto(ScheduleAutoBuildPlanner.PositionPlan plan) {
        return new ScheduleAutoBuildPositionPreviewDto(
                plan.positionConfigId(),
                plan.positionName(),
                plan.positionIds(),
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
                a.positionId(),
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

    private ScheduleAutoBuildRejectionHintDto toRejectionHintDto(ScheduleAutoBuildPlanner.RejectionHintPlan hint) {
        return new ScheduleAutoBuildRejectionHintDto(
                hint.memberId(),
                hint.memberName(),
                hint.date(),
                hint.positionConfigId(),
                hint.positionName(),
                hint.shiftOptionId(),
                hint.shiftLabel(),
                hint.startTime(),
                hint.endTime(),
                hint.reason(),
                hint.message()
        );
    }

    private ScheduleAutoBuildUncoveredSlotDto toUncoveredSlotDto(ScheduleAutoBuildPlanner.UncoveredSlotPlan slot) {
        return new ScheduleAutoBuildUncoveredSlotDto(
                slot.date(),
                slot.positionConfigId(),
                slot.positionIds(),
                slot.positionName(),
                slot.startTime(),
                slot.endTime(),
                slot.requiredCount(),
                slot.assignedCount()
        );
    }
}
