package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.schedule.dto.AdjustedScheduleAutoBuildAssignmentDto;
import ru.staffly.schedule.dto.ApplyScheduleAutoBuildRequest;
import ru.staffly.schedule.dto.ScheduleDto;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
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
    private final RestaurantMemberRepository members;
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

        ScheduleBuildTemplate template = resolveEffectiveTemplate(restaurantId, schedule, request.templateId());
        initializeTemplateCollections(template);
        validateTemplateHasSchedulePositions(schedule, template);

        boolean adjustedApply = hasAdjustedAssignments(request);
        ScheduleAutoBuildPlan plan = adjustedApply
                ? buildAdjustedPlan(restaurantId, schedule, template, request.adjustedAssignments())
                : planner.build(restaurantId, schedule, template);
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
                ScheduleAuditAction.AUTO_BUILD_APPLIED,
                buildAuditDetails(plan, skippedAssignments, countManualOverrides(request), adjustedApply)
        );

        return scheduleService.get(restaurantId, scheduleId, actorUserId);
    }


    private boolean hasAdjustedAssignments(ApplyScheduleAutoBuildRequest request) {
        return request.adjustedAssignments() != null;
    }

    private ScheduleAutoBuildPlan buildAdjustedPlan(Long restaurantId, Schedule schedule, ScheduleBuildTemplate template,
                                                   List<AdjustedScheduleAutoBuildAssignmentDto> adjustedAssignments) {
        if (adjustedAssignments.isEmpty()) {
            throw new BadRequestException("Переданный предпросмотр не содержит назначений");
        }

        Map<Long, RestaurantMember> membersById = members.findWithUserAndPositionByRestaurantId(restaurantId).stream()
                .collect(Collectors.toMap(RestaurantMember::getId, member -> member));
        Map<Long, ScheduleBuildPositionConfig> configsByPosition = configsByPosition(template);
        Set<Long> schedulePositions = new HashSet<>(schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds());
        Set<Long> affectedPositionIds = configsByPosition.keySet().stream()
                .filter(schedulePositions::contains)
                .collect(Collectors.toSet());
        Set<String> memberDays = new HashSet<>();
        Map<Long, List<ScheduleAutoBuildPlanner.AssignmentPlan>> byPosition = new HashMap<>();

        for (AdjustedScheduleAutoBuildAssignmentDto assignment : adjustedAssignments) {
            RestaurantMember member = validateAdjustedAssignment(schedule, configsByPosition, schedulePositions, memberDays, membersById, assignment);
            Long realPositionId = member.getPosition().getId();
            byPosition.computeIfAbsent(realPositionId, ignored -> new java.util.ArrayList<>()).add(
                    new ScheduleAutoBuildPlanner.AssignmentPlan(
                            assignment.memberId(),
                            hasText(assignment.memberName()) ? assignment.memberName() : memberDisplayName(member),
                            assignment.day(),
                            resolveAdjustedValue(assignment),
                            assignment.shiftOptionId(),
                            assignment.shiftLabel(),
                            assignment.startTime(),
                            assignment.endTime(),
                            hasText(assignment.reason()) ? assignment.reason() : "Изменено вручную",
                            "MANUAL_OVERRIDE",
                            assignment.warningMessage(),
                            List.of()
                    )
            );
        }

        List<ScheduleAutoBuildPlanner.PositionPlan> positions = byPosition.entrySet().stream()
                .map(entry -> {
                    ScheduleBuildPositionConfig config = configsByPosition.get(entry.getKey());
                    List<ScheduleAutoBuildPlanner.AssignmentPlan> cells = entry.getValue();
                    return new ScheduleAutoBuildPlanner.PositionPlan(entry.getKey(), configDisplayName(config), configPositionIds(config), cells, List.of(), cells.size(), 0, 0, 0);
                })
                .toList();

        return new ScheduleAutoBuildPlan(schedule.getId(), template.getId(), template.getName(), affectedPositionIds, positions, List.of(), List.of(), List.of(), adjustedAssignments.size(), 0, 0, 0);
    }

    private Map<Long, ScheduleBuildPositionConfig> configsByPosition(ScheduleBuildTemplate template) {
        Map<Long, ScheduleBuildPositionConfig> result = new HashMap<>();
        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            for (Long positionId : configPositionIds(config)) {
                if (result.put(positionId, config) != null) {
                    throw new BadRequestException("Position is used by multiple build configs: " + positionId);
                }
            }
        }
        return result;
    }

    private List<Long> configPositionIds(ScheduleBuildPositionConfig config) {
        if (config.getPositions() != null && !config.getPositions().isEmpty()) {
            return config.getPositions().stream().map(position -> position.getId()).filter(java.util.Objects::nonNull).sorted().toList();
        }
        return config.getPosition() == null || config.getPosition().getId() == null ? List.of() : List.of(config.getPosition().getId());
    }

    private String configDisplayName(ScheduleBuildPositionConfig config) {
        if (config.getPositions() != null && !config.getPositions().isEmpty()) {
            return config.getPositions().stream()
                    .sorted(java.util.Comparator.comparing(position -> position.getName(), java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                    .map(position -> position.getName())
                    .collect(Collectors.joining(" + "));
        }
        return config.getPosition() == null ? "Блок должностей" : config.getPosition().getName();
    }

    private RestaurantMember validateAdjustedAssignment(Schedule schedule, Map<Long, ScheduleBuildPositionConfig> configsByPosition,
                                                        Set<Long> schedulePositions, Set<String> memberDays,
                                                        Map<Long, RestaurantMember> membersById,
                                                        AdjustedScheduleAutoBuildAssignmentDto assignment) {
        if (assignment.memberId() == null || assignment.positionId() == null) {
            throw new BadRequestException("Переданное назначение должно содержать memberId и positionId");
        }
        if (!schedulePositions.contains(assignment.positionId())) {
            throw new BadRequestException("Позиция назначения не входит в график: " + assignment.positionId());
        }
        ScheduleBuildPositionConfig config = configsByPosition.get(assignment.positionId());
        if (config == null) {
            throw new BadRequestException("Шаблон не содержит позицию назначения: " + assignment.positionId());
        }
        RestaurantMember member = membersById.get(assignment.memberId());
        if (member == null) {
            throw new BadRequestException("Сотрудник не принадлежит ресторану: " + assignment.memberId());
        }
        Long memberPositionId = member.getPosition() == null ? null : member.getPosition().getId();
        if (memberPositionId == null || !schedulePositions.contains(memberPositionId)) {
            throw new BadRequestException("Должность сотрудника не входит в график: " + assignment.memberId());
        }
        if (!configPositionIds(config).contains(memberPositionId)) {
            throw new BadRequestException("Сотрудник не входит в блок должностей назначения: " + assignment.memberId());
        }

        LocalDate day = parseDay(assignment.day());
        if (day.isBefore(schedule.getStartDate()) || day.isAfter(schedule.getEndDate())) {
            throw new BadRequestException("Дата назначения вне периода графика: " + assignment.day());
        }
        LocalTime start = parseTime(assignment.startTime(), "startTime");
        LocalTime end = parseTime(assignment.endTime(), "endTime");
        if (start.equals(end)) {
            throw new BadRequestException("Начало и конец смены не должны совпадать: " + assignment.day());
        }
        boolean allowedShift = safeShiftOptions(config).stream().anyMatch(option -> shiftMatches(option, start, end, assignment.shiftOptionId()));
        if (!allowedShift) {
            throw new BadRequestException("Интервал назначения не входит в варианты смен для должности: " + assignment.day());
        }
        String key = assignment.memberId() + ":" + assignment.day();
        if (!memberDays.add(key)) {
            throw new BadRequestException("Один сотрудник не может иметь больше одной смены в день: " + assignment.day());
        }
        return member;
    }

    private List<ScheduleBuildShiftOption> safeShiftOptions(ScheduleBuildPositionConfig config) {
        return config.getShiftOptions() == null ? List.of() : config.getShiftOptions();
    }

    private boolean shiftMatches(ScheduleBuildShiftOption option, LocalTime start, LocalTime end, Long shiftOptionId) {
        if (shiftOptionId != null && !shiftOptionId.equals(option.getId())) {
            return false;
        }
        return option.getStartTime().equals(start) && option.getEndTime().equals(end);
    }

    private String resolveAdjustedValue(AdjustedScheduleAutoBuildAssignmentDto assignment) {
        if (hasText(assignment.value())) {
            return assignment.value().trim();
        }
        return formatInterval(assignment.startTime(), assignment.endTime());
    }

    private String memberDisplayName(RestaurantMember member) {
        String first = member.getUser() == null ? "" : java.util.Objects.toString(member.getUser().getFirstName(), "").trim();
        String last = member.getUser() == null ? "" : java.util.Objects.toString(member.getUser().getLastName(), "").trim();
        String full = (first + " " + last).trim();
        return full.isBlank() ? "Сотрудник #" + member.getId() : full;
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
            Hibernate.initialize(positionConfig.getPositions());
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
            Hibernate.initialize(positionConfig.getHeavyDaysOfWeek());
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
                .flatMap(config -> configPositionIds(config).stream())
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

    private int countManualOverrides(ApplyScheduleAutoBuildRequest request) {
        if (!hasAdjustedAssignments(request)) {
            return 0;
        }
        return Math.toIntExact(request.adjustedAssignments().stream()
                .filter(assignment -> "MANUAL_OVERRIDE".equalsIgnoreCase(assignment.matchStatus()))
                .count());
    }

    private String buildAuditDetails(ScheduleAutoBuildPlan plan, int skippedAssignments,
                                     int manualOverridesCount, boolean adjustedApply) {
        int uncoveredSlotsCount = plan.uncoveredSlots() == null ? 0 : plan.uncoveredSlots().size();
        return "Автосборка применена: "
                + plan.totalAssignments() + " назначений"
                + ", ручных правок: " + manualOverridesCount
                + ", незакрыто: " + uncoveredSlotsCount
                + ". Шаблон: " + plan.templateName()
                + " (templateId: " + plan.templateId() + ")"
                + ", adjustedAssignments: " + adjustedApply
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
