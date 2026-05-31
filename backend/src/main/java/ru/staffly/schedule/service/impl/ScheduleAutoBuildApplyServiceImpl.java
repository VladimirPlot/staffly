package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.schedule.dto.ApplyScheduleAutoBuildRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleCell;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAuditService;
import ru.staffly.schedule.service.ScheduleAutoBuildApplyService;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.util.Collections;
import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleAutoBuildApplyServiceImpl implements ScheduleAutoBuildApplyService {
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleRepository schedules;
    private final ScheduleBuildTemplateRepository templates;
    private final ScheduleAutoBuildPlanner planner;
    private final ScheduleAuditService scheduleAuditService;
    private final ScheduleService scheduleService;

    @Override
    public ScheduleDto apply(Long restaurantId, Long scheduleId, Long actorUserId, ApplyScheduleAutoBuildRequest request) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        validateScheduleStatus(schedule);

        ScheduleBuildTemplate template = templates
                .findDetailedByIdAndRestaurantIdAndIsActiveTrue(request.templateId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Active template not found: " + request.templateId()));
        validateTemplateHasSchedulePositions(schedule, template);

        var plan = planner.build(restaurantId, schedule, template);
        if (plan.totalAssignments() == 0) {
            throw new BadRequestException("Автосборка не создала ни одной смены");
        }

        Map<Long, ScheduleRow> rowsByMember = indexRowsByMember(schedule);
        clearAffectedCells(schedule, plan.affectedPositionIds());

        int skippedAssignments = applyAssignments(schedule, plan, rowsByMember);

        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        schedule.setPreferenceAppliedAt(TimeProvider.now());
        Schedule saved = schedules.save(schedule);

        scheduleAuditService.record(
                saved,
                actorUserId,
                ScheduleAuditAction.PREFERENCES_APPLIED,
                buildAuditDetails(plan, skippedAssignments)
        );

        return scheduleService.get(restaurantId, scheduleId, actorUserId);
    }

    private void validateScheduleStatus(Schedule schedule) {
        if (schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED
                && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Автосборка доступна только для статусов PREFERENCES_CLOSED или DRAFT_FROM_PREFERENCES");
        }
    }

    private void validateTemplateHasSchedulePositions(Schedule schedule, ScheduleBuildTemplate template) {
        List<Long> schedulePositions = schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds();
        Set<Long> templatePositionIds = template.getPositionConfigs().stream()
                .map(config -> config.getPosition().getId())
                .collect(Collectors.toSet());

        if (Collections.disjoint(templatePositionIds, schedulePositions)) {
            throw new BadRequestException("Шаблон не содержит конфигураций для позиций графика");
        }
    }

    private Map<Long, ScheduleRow> indexRowsByMember(Schedule schedule) {
        Map<Long, ScheduleRow> rowsByMember = new HashMap<>();
        for (ScheduleRow row : schedule.getRows()) {
            if (row.getMemberId() != null) {
                rowsByMember.put(row.getMemberId(), row);
            }
        }
        return rowsByMember;
    }

    private int applyAssignments(Schedule schedule, ScheduleAutoBuildPlan plan, Map<Long, ScheduleRow> rowsByMember) {
        int skippedAssignments = 0;

        for (var position : plan.positions()) {
            for (var assignment : position.cells()) {
                ScheduleRow row = rowsByMember.get(assignment.memberId());
                if (row == null) {
                    skippedAssignments++;
                    continue;
                }

                LocalDate day = LocalDate.parse(assignment.day());
                ScheduleCell existing = row.getCells().stream()
                        .filter(cell -> cell.getDay().equals(day))
                        .findFirst()
                        .orElse(null);
                if (existing != null) {
                    existing.setValue(assignment.value());
                } else {
                    row.getCells().add(ScheduleCell.builder().row(row).day(day).value(assignment.value()).build());
                }
            }
        }

        return skippedAssignments;
    }

    private String buildAuditDetails(ScheduleAutoBuildPlan plan, int skippedAssignments) {
        return "Автосборка графика выполнена по шаблону: " + plan.templateName()
                + ". Назначений: " + plan.totalAssignments()
                + ", незаполнено: " + plan.unfilledCount()
                + ", предупреждений: " + plan.warningsCount()
                + ", пропущено без строки: " + skippedAssignments;
    }

    private void clearAffectedCells(Schedule schedule, Set<Long> affectedPositionIds) {
        if (affectedPositionIds.isEmpty()) {
            return;
        }

        LocalDate start = schedule.getStartDate();
        LocalDate end = schedule.getEndDate();

        for (ScheduleRow row : schedule.getRows()) {
            if (row.getPositionId() == null || !affectedPositionIds.contains(row.getPositionId())) {
                continue;
            }
            row.getCells().removeIf(cell -> !cell.getDay().isBefore(start) && !cell.getDay().isAfter(end));
        }
    }
}
