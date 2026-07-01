package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.schedule.dto.ApplyScheduleAutoBuildRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleCell;
import ru.staffly.schedule.model.ScheduleCellSource;
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
import java.time.LocalTime;
import java.util.Collections;
import java.util.HashMap;
import java.util.HashSet;
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
        validateRequest(request);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        validateScheduleStatus(schedule);

        ScheduleBuildTemplate template = templates
                .findDetailedByIdAndRestaurantIdAndIsActiveTrue(request.templateId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Active template not found: " + request.templateId()));
        initializeTemplateCollections(template);
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

    private void initializeTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig positionConfig : template.getPositionConfigs()) {
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
        }
    }

    private void validateRequest(ApplyScheduleAutoBuildRequest request) {
        if (request == null || request.templateId() == null) {
            throw new BadRequestException("templateId is required");
        }
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

        Set<String> appliedMemberDays = new HashSet<>();

        for (var position : plan.positions()) {
            for (var assignment : position.cells()) {
                validateAssignment(assignment);
                String assignmentKey = assignment.memberId() + ":" + assignment.day();
                if (!appliedMemberDays.add(assignmentKey)) {
                    throw new BadRequestException("Автосборка содержит несколько смен для одного сотрудника в день: " + assignment.day());
                }

                ScheduleRow row = rowsByMember.get(assignment.memberId());
                if (row == null) {
                    skippedAssignments++;
                    continue;
                }

                LocalDate day = parseDay(assignment.day());
                ScheduleCell existing = row.getCells().stream()
                        .filter(cell -> cell.getDay().equals(day))
                        .findFirst()
                        .orElse(null);
                if (existing != null) {
                    existing.setValue(resolveCellValue(assignment));
                    existing.setSource(ScheduleCellSource.AUTO_BUILD);
                } else {
                    row.getCells().add(ScheduleCell.builder()
                            .row(row)
                            .day(day)
                            .value(resolveCellValue(assignment))
                            .source(ScheduleCellSource.AUTO_BUILD)
                            .build());
                }
            }
        }

        return skippedAssignments;
    }


    private void validateAssignment(ScheduleAutoBuildPlanner.AssignmentPlan assignment) {
        if (assignment.memberId() == null) {
            throw new BadRequestException("Автосборка содержит назначение без сотрудника");
        }
        parseDay(assignment.day());
        if (!hasText(assignment.value()) && (!hasText(assignment.startTime()) || !hasText(assignment.endTime()))) {
            throw new BadRequestException("Автосборка содержит назначение без смены: " + assignment.day());
        }
        if (hasText(assignment.startTime()) || hasText(assignment.endTime())) {
            parseTime(assignment.startTime(), "startTime");
            parseTime(assignment.endTime(), "endTime");
        }
    }

    private LocalDate parseDay(String day) {
        try {
            return LocalDate.parse(day);
        } catch (RuntimeException e) {
            throw new BadRequestException("Автосборка содержит некорректную дату смены: " + day);
        }
    }

    private LocalTime parseTime(String value, String field) {
        try {
            return LocalTime.parse(value);
        } catch (RuntimeException e) {
            throw new BadRequestException("Автосборка содержит некорректное время " + field + ": " + value);
        }
    }

    private String resolveCellValue(ScheduleAutoBuildPlanner.AssignmentPlan assignment) {
        if (hasText(assignment.startTime()) && hasText(assignment.endTime())) {
            return formatInterval(assignment.startTime(), assignment.endTime());
        }
        return assignment.value().trim();
    }

    private String formatInterval(String startTime, String endTime) {
        return parseTime(startTime, "startTime").toString() + "–" + parseTime(endTime, "endTime").toString();
    }

    private boolean hasText(String value) {
        return value != null && !value.isBlank();
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
