package ru.staffly.schedule.service.impl.autobuild;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildCoverageRule;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.AssignmentPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.PositionPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ScheduleAutoBuildPlannerImpl implements ScheduleAutoBuildPlanner {
    private static final int END_OF_DAY_MINUTES = 24 * 60;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final RestaurantMemberRepository members;
    private final SchedulePreferenceSubmissionRepository submissions;

    @Override
    public ScheduleAutoBuildPlan build(Long restaurantId, Schedule schedule, ScheduleBuildTemplate template) {
        initializeTemplateCollections(template);

        List<String> topWarnings = new ArrayList<>();
        List<Long> schedulePositions = schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds();
        List<ScheduleBuildPositionConfig> positionConfigs = safePositionConfigs(template);
        Set<Long> templatePositionIds = positionConfigs.stream()
                .map(config -> config.getPosition().getId())
                .collect(Collectors.toSet());

        for (ScheduleBuildPositionConfig config : positionConfigs) {
            Long positionId = config.getPosition().getId();
            if (!schedulePositions.contains(positionId)) {
                topWarnings.add("В шаблоне есть позиция вне графика: " + config.getPosition().getName());
            }
            if (config.getMinRestHours() != null || config.getMaxShiftsPerPeriod() != null) {
                topWarnings.add("Ограничения minRestHours/maxShiftsPerPeriod будут применены на следующем этапе");
            }
        }

        for (Long schedulePositionId : schedulePositions) {
            if (!templatePositionIds.contains(schedulePositionId)) {
                topWarnings.add("Для одной из позиций графика нет конфигурации в шаблоне (positionId=" + schedulePositionId + ")");
            }
        }

        Map<Long, List<SchedulePreferenceCell>> preferencesByMember = loadPreferencesByMember(schedule.getId());
        List<PositionPlan> positions = new ArrayList<>();

        for (ScheduleBuildPositionConfig config : positionConfigs) {
            if (!schedulePositions.contains(config.getPosition().getId())) {
                continue;
            }
            PositionPlan positionPlan = buildPosition(restaurantId, schedule, config, preferencesByMember);
            positions.add(positionPlan);
        }

        List<String> distinctTopWarnings = topWarnings.stream().distinct().toList();
        Set<Long> affected = positions.stream().map(PositionPlan::positionId).collect(Collectors.toSet());
        int totalAssignments = positions.stream().mapToInt(PositionPlan::totalAssignments).sum();
        int unfilledCount = positions.stream().mapToInt(PositionPlan::unfilledCount).sum();
        int negativeAssignmentsCount = positions.stream().mapToInt(PositionPlan::negativeAssignmentsCount).sum();
        int warningsCount = distinctTopWarnings.size() + positions.stream().mapToInt(PositionPlan::warningsCount).sum();

        return new ScheduleAutoBuildPlan(
                schedule.getId(),
                template.getId(),
                template.getName(),
                affected,
                positions,
                distinctTopWarnings,
                totalAssignments,
                warningsCount,
                unfilledCount,
                negativeAssignmentsCount
        );
    }

    private PositionPlan buildPosition(
            Long restaurantId,
            Schedule schedule,
            ScheduleBuildPositionConfig config,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember
    ) {
        List<RestaurantMember> candidates = loadCandidates(restaurantId, config);
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        Map<LocalDate, Set<Long>> usedMembersByDay = new HashMap<>();

        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            DayBuildResult dayResult = buildAssignmentsForDay(
                    day,
                    config,
                    candidates,
                    preferencesByMember,
                    usedMembersByDay
            );
            assignments.addAll(dayResult.assignments());
            warnings.addAll(dayResult.warnings());
            unfilledCount += dayResult.unfilledCount();
            negativeAssignmentsCount += dayResult.negativeAssignmentsCount();
        }

        PositionCounters counters = buildPositionCounters(assignments, warnings, unfilledCount, negativeAssignmentsCount);

        return new PositionPlan(
                config.getPosition().getId(),
                config.getPosition().getName(),
                assignments,
                counters.distinctWarnings(),
                counters.totalAssignments(),
                counters.warningsCount(),
                counters.unfilledCount(),
                counters.negativeAssignmentsCount()
        );
    }

    private List<RestaurantMember> loadCandidates(Long restaurantId, ScheduleBuildPositionConfig config) {
        List<RestaurantMember> foundMembers = members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                restaurantId,
                List.of(config.getPosition().getId())
        );

        return foundMembers.stream()
                .filter(member -> member.getUser() != null)
                .toList();
    }

    private DayBuildResult buildAssignmentsForDay(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            Map<LocalDate, Set<Long>> usedMembersByDay
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        int dayOfWeek = day.getDayOfWeek().getValue();
        List<ScheduleBuildCoverageRule> coverageRules = safeCoverageRules(config).stream()
                .filter(rule -> rule.getDayOfWeek() == dayOfWeek)
                .toList();

        for (ScheduleBuildCoverageRule rule : coverageRules) {
            CoverageRuleResult ruleResult = buildAssignmentForCoverageRule(
                    day,
                    config,
                    rule,
                    candidates,
                    preferencesByMember,
                    usedMembersByDay
            );

            assignments.addAll(ruleResult.assignments());
            warnings.addAll(ruleResult.warnings());
            unfilledCount += ruleResult.unfilledCount();
            negativeAssignmentsCount += ruleResult.negativeAssignmentsCount();
        }

        return new DayBuildResult(assignments, warnings, unfilledCount, negativeAssignmentsCount);
    }

    private CoverageRuleResult buildAssignmentForCoverageRule(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            ScheduleBuildCoverageRule rule,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            Map<LocalDate, Set<Long>> usedMembersByDay
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        List<ScheduleBuildShiftOption> shiftOptions = safeShiftOptions(config);
        ScheduleBuildShiftOption option = findShiftOption(shiftOptions, rule);
        if (option == null) {
            warnings.add("Не найден shiftOption для правила " + rule.getStartTime() + "-" + rule.getEndTime());
            return new CoverageRuleResult(assignments, warnings, unfilledCount, negativeAssignmentsCount);
        }

        int requiredCount = safeRequiredCount(rule);
        Set<Long> usedOnDay = usedMembersByDay.computeIfAbsent(day, ignored -> new HashSet<>());

        for (int index = 0; index < requiredCount; index++) {
            RestaurantMember selected = pickMember(candidates, preferencesByMember, day, option, usedOnDay);
            if (selected == null) {
                warnings.add("Недостаточно сотрудников для покрытия " + day + " " + formatShift(option));
                unfilledCount++;
                continue;
            }

            List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(selected.getId(), List.of());
            AssignmentBuildResult assignmentResult = createAssignment(selected, day, option, memberCells);

            assignments.add(assignmentResult.assignment());
            if (assignmentResult.grade() == PreferenceGrade.NEGATIVE) {
                negativeAssignmentsCount++;
            }
            usedOnDay.add(selected.getId());
        }

        return new CoverageRuleResult(assignments, warnings, unfilledCount, negativeAssignmentsCount);
    }

    private AssignmentBuildResult createAssignment(
            RestaurantMember member,
            LocalDate day,
            ScheduleBuildShiftOption option,
            List<SchedulePreferenceCell> memberCells
    ) {
        List<String> cellWarnings = new ArrayList<>();
        PreferenceGrade grade = grade(memberCells, day, option);
        String reason = reasonFor(memberCells, day, option, cellWarnings, grade);

        AssignmentPlan assignment = new AssignmentPlan(
                member.getId(),
                displayName(member),
                day.toString(),
                formatShift(option),
                option.getId(),
                option.getLabel(),
                reason,
                cellWarnings
        );

        return new AssignmentBuildResult(assignment, grade);
    }

    private PositionCounters buildPositionCounters(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
        List<String> distinctWarnings = warnings.stream().distinct().toList();
        int cellWarningsCount = assignments.stream().mapToInt(plan -> plan.warnings().size()).sum();
        int warningsCount = distinctWarnings.size() + cellWarningsCount;

        return new PositionCounters(
                distinctWarnings,
                assignments.size(),
                warningsCount,
                unfilledCount,
                negativeAssignmentsCount
        );
    }

    private RestaurantMember pickMember(
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            LocalDate day,
            ScheduleBuildShiftOption option,
            Set<Long> usedMemberIds
    ) {
        List<RestaurantMember> positive = new ArrayList<>();
        List<RestaurantMember> neutral = new ArrayList<>();
        List<RestaurantMember> negative = new ArrayList<>();

        for (RestaurantMember member : candidates) {
            if (usedMemberIds.contains(member.getId())) {
                continue;
            }

            PreferenceGrade memberGrade = grade(preferencesByMember.getOrDefault(member.getId(), List.of()), day, option);
            if (memberGrade == PreferenceGrade.POSITIVE) {
                positive.add(member);
            } else if (memberGrade == PreferenceGrade.NONE) {
                neutral.add(member);
            } else {
                negative.add(member);
            }
        }

        if (!positive.isEmpty()) {
            return positive.get(0);
        }
        if (!neutral.isEmpty()) {
            return neutral.get(0);
        }
        if (negative.isEmpty()) {
            return null;
        }
        return negative.get(0);
    }

    private String reasonFor(
            List<SchedulePreferenceCell> cells,
            LocalDate day,
            ScheduleBuildShiftOption option,
            List<String> warnings,
            PreferenceGrade grade
    ) {
        if (grade == PreferenceGrade.POSITIVE) {
            if (hasPartialPositiveOverlap(cells, day, option)) {
                warnings.add("Пожелание частично пересекается со сменой");
            }
            return "Подходит по пожеланию";
        }

        if (grade == PreferenceGrade.NEGATIVE) {
            warnings.add("Есть отрицательное пожелание на этот день");
            return "Поставлен для покрытия потребности";
        }

        return "Нет пожелания, выбран по доступности";
    }

    private PreferenceGrade grade(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option) {
        List<SchedulePreferenceCell> dayCells = cells.stream()
                .filter(cell -> cell != null && day.equals(cell.getDay()))
                .toList();

        if (dayCells.isEmpty()) {
            return PreferenceGrade.NONE;
        }

        boolean hasPositive = dayCells.stream().anyMatch(cell -> isPositiveForShift(cell, option));
        if (hasPositive) {
            return PreferenceGrade.POSITIVE;
        }

        boolean hasNegative = dayCells.stream().anyMatch(cell -> isNegativeForShift(cell, option));
        if (hasNegative) {
            return PreferenceGrade.NEGATIVE;
        }

        return PreferenceGrade.NONE;
    }

    private boolean isPositiveForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option) {
        if (!isPositiveType(cell.getType())) {
            return false;
        }
        if (cell.isFullDay()) {
            return true;
        }
        if (cell.getStartTime() == null || cell.getEndTime() == null) {
            return false;
        }

        return overlaps(
                toMinute(cell.getStartTime(), false),
                toMinute(cell.getEndTime(), true),
                toMinute(option.getStartTime(), false),
                toMinute(option.getEndTime(), true)
        );
    }

    private boolean isNegativeForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option) {
        if (!isNegativeType(cell.getType())) {
            return false;
        }
        if (cell.isFullDay()) {
            return true;
        }
        if (cell.getStartTime() == null || cell.getEndTime() == null) {
            return false;
        }

        return overlaps(
                toMinute(cell.getStartTime(), false),
                toMinute(cell.getEndTime(), true),
                toMinute(option.getStartTime(), false),
                toMinute(option.getEndTime(), true)
        );
    }

    private boolean hasPartialPositiveOverlap(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option) {
        int shiftStart = toMinute(option.getStartTime(), false);
        int shiftEnd = toMinute(option.getEndTime(), true);

        return cells.stream().anyMatch(cell -> {
            if (cell == null || !day.equals(cell.getDay())) {
                return false;
            }
            if (cell.isFullDay() || !isPositiveType(cell.getType())) {
                return false;
            }
            if (cell.getStartTime() == null || cell.getEndTime() == null) {
                return false;
            }

            boolean hasOverlap = overlaps(
                    toMinute(cell.getStartTime(), false),
                    toMinute(cell.getEndTime(), true),
                    shiftStart,
                    shiftEnd
            );
            boolean fullyCoversShift = coversInterval(
                    cell.getStartTime(),
                    cell.getEndTime(),
                    option.getStartTime(),
                    option.getEndTime()
            );
            boolean exactMatch = intervalsEqual(
                    cell.getStartTime(),
                    cell.getEndTime(),
                    option.getStartTime(),
                    option.getEndTime()
            );

            return hasOverlap && !fullyCoversShift && !exactMatch;
        });
    }

    private boolean isPositiveType(SchedulePreferenceType type) {
        return type == SchedulePreferenceType.AVAILABLE || type == SchedulePreferenceType.PREFER_WORK;
    }

    private boolean isNegativeType(SchedulePreferenceType type) {
        return type == SchedulePreferenceType.UNAVAILABLE || type == SchedulePreferenceType.PREFER_DAY_OFF;
    }

    private ScheduleBuildShiftOption findShiftOption(List<ScheduleBuildShiftOption> options, ScheduleBuildCoverageRule rule) {
        for (ScheduleBuildShiftOption option : options) {
            boolean exactMatch = option.getStartTime().equals(rule.getStartTime())
                    && option.getEndTime().equals(rule.getEndTime());
            if (exactMatch) {
                return option;
            }
        }

        for (ScheduleBuildShiftOption option : options) {
            boolean containsRuleInterval = covers(
                    toMinute(option.getStartTime(), false),
                    toMinute(option.getEndTime(), true),
                    toMinute(rule.getStartTime(), false),
                    toMinute(rule.getEndTime(), true)
            );
            if (containsRuleInterval) {
                return option;
            }
        }

        return null;
    }

    private String displayName(RestaurantMember member) {
        String fullName = Optional.ofNullable(member.getUser().getFullName()).map(String::trim).orElse("");
        if (!fullName.isBlank()) {
            return fullName;
        }

        String firstName = Optional.ofNullable(member.getUser().getFirstName()).orElse("");
        String lastName = Optional.ofNullable(member.getUser().getLastName()).orElse("");
        String firstLast = (firstName + " " + lastName).trim();
        if (!firstLast.isBlank()) {
            return firstLast;
        }

        return "Сотрудник #" + member.getId();
    }

    private String formatShift(ScheduleBuildShiftOption option) {
        return option.getStartTime().format(HH_MM) + "-" + option.getEndTime().format(HH_MM);
    }

    private int toMinute(LocalTime time, boolean endTime) {
        if (endTime && LocalTime.MIDNIGHT.equals(time)) {
            return END_OF_DAY_MINUTES;
        }
        return time.getHour() * 60 + time.getMinute();
    }

    private boolean overlaps(int startA, int endA, int startB, int endB) {
        return startA < endB && startB < endA;
    }

    private boolean covers(int startA, int endA, int startB, int endB) {
        return startA <= startB && endA >= endB;
    }

    private boolean coversInterval(LocalTime aStart, LocalTime aEnd, LocalTime bStart, LocalTime bEnd) {
        return covers(
                toMinute(aStart, false),
                toMinute(aEnd, true),
                toMinute(bStart, false),
                toMinute(bEnd, true)
        );
    }

    private boolean intervalsEqual(LocalTime aStart, LocalTime aEnd, LocalTime bStart, LocalTime bEnd) {
        return toMinute(aStart, false) == toMinute(bStart, false)
                && toMinute(aEnd, true) == toMinute(bEnd, true);
    }

    private void initializeTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig positionConfig : safePositionConfigs(template)) {
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
        }
    }

    private List<ScheduleBuildPositionConfig> safePositionConfigs(ScheduleBuildTemplate template) {
        if (template.getPositionConfigs() == null) {
            return List.of();
        }
        return template.getPositionConfigs();
    }

    private List<ScheduleBuildShiftOption> safeShiftOptions(ScheduleBuildPositionConfig config) {
        if (config.getShiftOptions() == null) {
            return List.of();
        }
        return config.getShiftOptions();
    }

    private List<ScheduleBuildCoverageRule> safeCoverageRules(ScheduleBuildPositionConfig config) {
        if (config.getCoverageRules() == null) {
            return List.of();
        }
        return config.getCoverageRules();
    }

    private int safeRequiredCount(ScheduleBuildCoverageRule rule) {
        Integer requiredCount = rule.getRequiredCount();
        if (requiredCount == null || requiredCount <= 0) {
            return 0;
        }
        return requiredCount;
    }

    private Map<Long, List<SchedulePreferenceCell>> loadPreferencesByMember(Long scheduleId) {
        return submissions.findWithCellsByScheduleId(scheduleId).stream()
                .filter(submission -> submission.getMember() != null)
                .collect(Collectors.toMap(
                        submission -> submission.getMember().getId(),
                        SchedulePreferenceSubmission::getCells,
                        (left, right) -> left
                ));
    }

    private enum PreferenceGrade {
        POSITIVE,
        NONE,
        NEGATIVE
    }

    private record DayBuildResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }

    private record CoverageRuleResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }

    private record AssignmentBuildResult(AssignmentPlan assignment, PreferenceGrade grade) {
    }

    private record PositionCounters(
            List<String> distinctWarnings,
            int totalAssignments,
            int warningsCount,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }
}
