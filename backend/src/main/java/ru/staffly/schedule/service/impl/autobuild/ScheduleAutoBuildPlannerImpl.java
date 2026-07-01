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
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.AssignmentPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.PositionPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.UncoveredSlotPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.HashMap;
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
        }

        for (Long schedulePositionId : schedulePositions) {
            if (!templatePositionIds.contains(schedulePositionId)) {
                topWarnings.add("Для одной из позиций графика нет конфигурации в шаблоне (positionId=" + schedulePositionId + ")");
            }
        }

        Map<Long, List<SchedulePreferenceCell>> preferencesByMember = loadPreferencesByMember(schedule.getId());
        PlannerState plannerState = new PlannerState();
        List<PositionPlan> positions = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();

        for (ScheduleBuildPositionConfig config : positionConfigs) {
            if (!schedulePositions.contains(config.getPosition().getId())) {
                continue;
            }
            PositionBuildResult positionResult = buildPosition(restaurantId, schedule, config, preferencesByMember, plannerState);
            positions.add(positionResult.positionPlan());
            uncoveredSlots.addAll(positionResult.uncoveredSlots());
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
                uncoveredSlots,
                totalAssignments,
                warningsCount,
                unfilledCount,
                negativeAssignmentsCount
        );
    }

    private PositionBuildResult buildPosition(
            Long restaurantId,
            Schedule schedule,
            ScheduleBuildPositionConfig config,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            PlannerState plannerState
    ) {
        List<RestaurantMember> candidates = loadCandidates(restaurantId, config);
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();

        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            DayBuildResult dayResult = buildAssignmentsForDay(
                    day,
                    config,
                    candidates,
                    preferencesByMember,
                    plannerState
            );
            assignments.addAll(dayResult.assignments());
            warnings.addAll(dayResult.warnings());
            uncoveredSlots.addAll(dayResult.uncoveredSlots());
            unfilledCount += dayResult.unfilledCount();
            negativeAssignmentsCount += dayResult.negativeAssignmentsCount();
        }

        PositionCounters counters = buildPositionCounters(assignments, warnings, unfilledCount, negativeAssignmentsCount);

        PositionPlan positionPlan = new PositionPlan(
                config.getPosition().getId(),
                config.getPosition().getName(),
                assignments,
                counters.distinctWarnings(),
                counters.totalAssignments(),
                counters.warningsCount(),
                counters.unfilledCount(),
                counters.negativeAssignmentsCount()
        );
        return new PositionBuildResult(positionPlan, uncoveredSlots);
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
            PlannerState plannerState
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        int dayOfWeek = day.getDayOfWeek().getValue();
        List<ScheduleBuildCoverageRule> allCoverageRules = safeCoverageRules(config);
        if (allCoverageRules.isEmpty()) {
            return buildLegacyAssignmentsForDay(day, config, candidates, preferencesByMember, plannerState);
        }

        List<ScheduleBuildCoverageRule> coverageRules = allCoverageRules.stream()
                .filter(rule -> rule.getDayOfWeek() == dayOfWeek)
                .toList();

        for (ScheduleBuildCoverageRule rule : coverageRules) {
            CoverageRuleResult ruleResult = buildAssignmentForCoverageRule(
                    day,
                    config,
                    rule,
                    candidates,
                    preferencesByMember,
                    plannerState
            );

            assignments.addAll(ruleResult.assignments());
            warnings.addAll(ruleResult.warnings());
            uncoveredSlots.addAll(ruleResult.uncoveredSlots());
            unfilledCount += ruleResult.unfilledCount();
            negativeAssignmentsCount += ruleResult.negativeAssignmentsCount();
        }

        return new DayBuildResult(assignments, warnings, uncoveredSlots, unfilledCount, negativeAssignmentsCount);
    }

    private CoverageRuleResult buildAssignmentForCoverageRule(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            ScheduleBuildCoverageRule rule,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            PlannerState plannerState
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        int requiredCount = safeRequiredCount(rule);
        List<ScheduleBuildShiftOption> shiftOptions = safeShiftOptions(config);
        ScheduleBuildShiftOption singleOption = findExactShiftOption(shiftOptions, rule);

        for (int index = 0; index < requiredCount; index++) {
            if (singleOption != null) {
                CandidateSelectionResult singleSelection = pickMember(
                        candidates,
                        preferencesByMember,
                        day,
                        singleOption,
                        config,
                        plannerState
                );
                if (singleSelection.selected() != null) {
                    if (singleSelection.selected().grade() != PreferenceGrade.NEGATIVE) {
                        AssignmentBuildResult assignmentResult = assignSelected(
                                assignments,
                                plannerState,
                                singleSelection.selected().member(),
                                day,
                                singleOption,
                                preferencesByMember
                        );
                        if (assignmentResult.grade() == PreferenceGrade.NEGATIVE) {
                            negativeAssignmentsCount++;
                        }
                        continue;
                    }

                    CoverageLayerResult positiveSplitResult = buildFallbackCoverageLayer(
                            day,
                            config,
                            rule,
                            candidates,
                            preferencesByMember,
                            plannerState,
                            shiftOptions,
                            false,
                            true
                    );
                    if (positiveSplitResult.isComplete()) {
                        assignments.addAll(positiveSplitResult.assignments());
                        warnings.addAll(positiveSplitResult.warnings());
                        uncoveredSlots.addAll(positiveSplitResult.uncoveredSlots());
                        unfilledCount += positiveSplitResult.unfilledCount();
                        negativeAssignmentsCount += positiveSplitResult.negativeAssignmentsCount();
                        continue;
                    }

                    AssignmentBuildResult assignmentResult = assignSelected(
                            assignments,
                            plannerState,
                            singleSelection.selected().member(),
                            day,
                            singleOption,
                            preferencesByMember
                    );
                    if (assignmentResult.grade() == PreferenceGrade.NEGATIVE) {
                        negativeAssignmentsCount++;
                    }
                    continue;
                }
            }

            CoverageLayerResult layerResult = buildFallbackCoverageLayer(
                    day,
                    config,
                    rule,
                    candidates,
                    preferencesByMember,
                    plannerState,
                    shiftOptions,
                    true,
                    false
            );
            assignments.addAll(layerResult.assignments());
            warnings.addAll(layerResult.warnings());
            uncoveredSlots.addAll(layerResult.uncoveredSlots());
            unfilledCount += layerResult.unfilledCount();
            negativeAssignmentsCount += layerResult.negativeAssignmentsCount();
        }

        return new CoverageRuleResult(assignments, warnings, uncoveredSlots, unfilledCount, negativeAssignmentsCount);
    }

    private CoverageLayerResult buildFallbackCoverageLayer(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            ScheduleBuildCoverageRule rule,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            PlannerState plannerState,
            List<ScheduleBuildShiftOption> shiftOptions,
            boolean allowNegativeAssignments,
            boolean requireComplete
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        int negativeAssignmentsCount = 0;
        int unfilledCount = 0;

        PlannerState workingState = requireComplete ? plannerState.copy() : plannerState;
        int ruleStart = toMinute(rule.getStartTime(), false);
        int ruleEnd = toMinute(rule.getEndTime(), true);
        int cursor = ruleStart;

        while (cursor < ruleEnd) {
            SplitOptionSelection splitSelection = selectSplitOption(
                    shiftOptions,
                    rule,
                    cursor,
                    candidates,
                    preferencesByMember,
                    day,
                    config,
                    workingState,
                    allowNegativeAssignments
            );

            if (splitSelection.option() == null || splitSelection.selection().selected() == null) {
                int nextBoundary = nextCoverageBoundary(shiftOptions, rule, cursor, ruleEnd);
                LocalTime uncoveredStart = minuteToTime(cursor);
                LocalTime uncoveredEnd = minuteToTime(nextBoundary);
                ScheduleBuildShiftOption warningOption = ScheduleBuildShiftOption.builder()
                        .startTime(uncoveredStart)
                        .endTime(uncoveredEnd)
                        .build();
                warnings.add(unfilledWarning(day, warningOption, splitSelection.selection()));
                uncoveredSlots.add(toUncoveredSlot(day, config.getPosition().getId(), uncoveredStart, uncoveredEnd, 1, 0));
                unfilledCount++;
                cursor = nextBoundary;
                continue;
            }

            ScheduleBuildShiftOption option = splitSelection.option();
            RestaurantMember selected = splitSelection.selection().selected().member();
            AssignmentBuildResult assignmentResult = assignSelected(
                    assignments,
                    workingState,
                    selected,
                    day,
                    option,
                    preferencesByMember
            );
            if (assignmentResult.grade() == PreferenceGrade.NEGATIVE) {
                negativeAssignmentsCount++;
            }
            cursor = Math.max(cursor + 1, toMinute(option.getEndTime(), true));
        }

        boolean complete = uncoveredSlots.isEmpty() && cursor >= ruleEnd;
        if (requireComplete && !complete) {
            return new CoverageLayerResult(List.of(), List.of(), List.of(), 0, 0, false);
        }
        if (requireComplete) {
            plannerState.replaceWith(workingState);
        }

        return new CoverageLayerResult(assignments, warnings, uncoveredSlots, unfilledCount, negativeAssignmentsCount, complete);
    }

    private AssignmentBuildResult assignSelected(
            List<AssignmentPlan> assignments,
            PlannerState plannerState,
            RestaurantMember selected,
            LocalDate day,
            ScheduleBuildShiftOption option,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember
    ) {
        List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(selected.getId(), List.of());
        AssignmentBuildResult assignmentResult = createAssignment(selected, day, option, memberCells);
        assignments.add(assignmentResult.assignment());
        registerAssignment(plannerState, selected, day, option);
        return assignmentResult;
    }

    private SplitOptionSelection selectSplitOption(
            List<ScheduleBuildShiftOption> shiftOptions,
            ScheduleBuildCoverageRule rule,
            int cursor,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            LocalDate day,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            boolean allowNegativeAssignments
    ) {
        SplitOptionSelection best = null;
        for (ScheduleBuildShiftOption option : shiftOptions) {
            int optionStart = toMinute(option.getStartTime(), false);
            int optionEnd = toMinute(option.getEndTime(), true);
            if (optionStart < toMinute(rule.getStartTime(), false) || optionEnd > toMinute(rule.getEndTime(), true)) {
                continue;
            }
            if (optionStart > cursor || optionEnd <= cursor) {
                continue;
            }
            CandidateSelectionResult selection = pickMember(candidates, preferencesByMember, day, option, config, plannerState);
            if (!allowNegativeAssignments && selection.selected() != null && selection.selected().grade() == PreferenceGrade.NEGATIVE) {
                selection = new CandidateSelectionResult(
                        null,
                        selection.maxShiftsRejectedCount(),
                        selection.minRestRejectedCount(),
                        selection.overlapRejectedCount()
                );
            }
            if (selection.selected() == null) {
                best = best == null ? new SplitOptionSelection(option, selection) : best;
                continue;
            }
            SplitOptionSelection current = new SplitOptionSelection(option, selection);
            if (best == null || compareSplitOption(current, best, cursor) < 0) {
                best = current;
            }
        }
        return best == null ? new SplitOptionSelection(null, CandidateSelectionResult.empty()) : best;
    }

    private int compareSplitOption(SplitOptionSelection left, SplitOptionSelection right, int cursor) {
        CandidateEvaluation leftCandidate = left.selection().selected();
        CandidateEvaluation rightCandidate = right.selection().selected();
        if (leftCandidate == null && rightCandidate != null) {
            return 1;
        }
        if (leftCandidate != null && rightCandidate == null) {
            return -1;
        }
        int leftStart = toMinute(left.option().getStartTime(), false);
        int rightStart = toMinute(right.option().getStartTime(), false);
        int byExactStart = Boolean.compare(rightStart == cursor, leftStart == cursor);
        if (byExactStart != 0) {
            return byExactStart;
        }
        int byGrade = Integer.compare(gradeRank(leftCandidate.grade()), gradeRank(rightCandidate.grade()));
        if (byGrade != 0) {
            return byGrade;
        }
        int byEnd = Integer.compare(toMinute(left.option().getEndTime(), true), toMinute(right.option().getEndTime(), true));
        if (byEnd != 0) {
            return byEnd;
        }
        return Integer.compare(
                Optional.ofNullable(left.option().getSortOrder()).orElse(0),
                Optional.ofNullable(right.option().getSortOrder()).orElse(0)
        );
    }

    private int matchStatusRank(MatchStatus matchStatus) {
        return switch (matchStatus) {
            case EXACT_INTERVAL_PREFERENCE -> 0;
            case COVERING_INTERVAL_PREFERENCE -> 1;
            case FULL_DAY_POSITIVE -> 2;
            case NO_PREFERENCE -> 3;
            case NEGATIVE_FALLBACK -> 4;
        };
    }

    private int gradeRank(PreferenceGrade grade) {
        if (grade == PreferenceGrade.POSITIVE) {
            return 0;
        }
        if (grade == PreferenceGrade.NONE) {
            return 1;
        }
        return 2;
    }

    private int nextCoverageBoundary(List<ScheduleBuildShiftOption> shiftOptions, ScheduleBuildCoverageRule rule, int cursor, int ruleEnd) {
        return shiftOptions.stream()
                .mapToInt(option -> toMinute(option.getStartTime(), false))
                .filter(start -> start > cursor && start < ruleEnd)
                .min()
                .orElse(ruleEnd);
    }

    private LocalTime minuteToTime(int minute) {
        if (minute >= END_OF_DAY_MINUTES) {
            return LocalTime.MIDNIGHT;
        }
        return LocalTime.of(minute / 60, minute % 60);
    }

    private AssignmentBuildResult createAssignment(
            RestaurantMember member,
            LocalDate day,
            ScheduleBuildShiftOption option,
            List<SchedulePreferenceCell> memberCells
    ) {
        List<String> cellWarnings = new ArrayList<>();
        MatchStatus matchStatus = matchStatusFor(memberCells, day, option);
        PreferenceGrade grade = grade(matchStatus);
        String reason = reasonFor(cellWarnings, matchStatus);
        String warningMessage = warningMessageFor(matchStatus);

        AssignmentPlan assignment = new AssignmentPlan(
                member.getId(),
                displayName(member),
                day.toString(),
                formatShift(option),
                option.getId(),
                option.getLabel(),
                option.getStartTime().toString(),
                option.getEndTime().toString(),
                reason,
                matchStatus.name(),
                warningMessage,
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

    private CandidateSelectionResult pickMember(
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState
    ) {
        List<CandidateEvaluation> positive = new ArrayList<>();
        List<CandidateEvaluation> neutral = new ArrayList<>();
        List<CandidateEvaluation> negative = new ArrayList<>();
        int maxShiftsRejectedCount = 0;
        int minRestRejectedCount = 0;
        int overlapRejectedCount = 0;

        for (RestaurantMember member : candidates) {
            CandidateEvaluation evaluation = evaluateCandidate(
                    member,
                    preferencesByMember,
                    day,
                    option,
                    config,
                    plannerState
            );
            if (!evaluation.eligible()) {
                if (evaluation.rejectionReason() == CandidateRejectionReason.MAX_SHIFTS) {
                    maxShiftsRejectedCount++;
                } else if (evaluation.rejectionReason() == CandidateRejectionReason.MIN_REST) {
                    minRestRejectedCount++;
                } else if (evaluation.rejectionReason() == CandidateRejectionReason.OVERLAP) {
                    overlapRejectedCount++;
                }
                continue;
            }

            if (evaluation.grade() == PreferenceGrade.POSITIVE) {
                positive.add(evaluation);
            } else if (evaluation.grade() == PreferenceGrade.NONE) {
                neutral.add(evaluation);
            } else {
                negative.add(evaluation);
            }
        }

        CandidateEvaluation selected = selectBestCandidate(positive);
        if (selected == null) {
            selected = selectBestCandidate(neutral);
        }
        if (selected == null) {
            selected = selectBestCandidate(negative);
        }

        return new CandidateSelectionResult(
                selected,
                maxShiftsRejectedCount,
                minRestRejectedCount,
                overlapRejectedCount
        );
    }

    private CandidateEvaluation evaluateCandidate(
            RestaurantMember member,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState
    ) {
        int shiftsCount = plannerState.shiftsCount(member.getId());
        String displayName = displayName(member);
        CandidateRejectionReason rejectionReason = hardConstraintRejectionReason(
                member,
                day,
                option,
                config,
                plannerState
        );

        if (rejectionReason != CandidateRejectionReason.NONE) {
            return new CandidateEvaluation(
                    member,
                    MatchStatus.NO_PREFERENCE,
                    PreferenceGrade.NONE,
                    shiftsCount,
                    displayName,
                    false,
                    rejectionReason
            );
        }

        List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(member.getId(), List.of());
        MatchStatus matchStatus = matchStatusFor(memberCells, day, option);
        PreferenceGrade memberGrade = grade(matchStatus);
        if (matchStatus == MatchStatus.NO_PREFERENCE && hasPartialPositiveOverlap(memberCells, day, option)) {
            matchStatus = MatchStatus.NEGATIVE_FALLBACK;
            memberGrade = PreferenceGrade.NEGATIVE;
        }
        return new CandidateEvaluation(
                member,
                matchStatus,
                memberGrade,
                shiftsCount,
                displayName,
                true,
                CandidateRejectionReason.NONE
        );
    }

    private CandidateRejectionReason hardConstraintRejectionReason(
            RestaurantMember member,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState
    ) {
        if (violatesMaxShifts(member, config, plannerState)) {
            return CandidateRejectionReason.MAX_SHIFTS;
        }
        if (hasAssignmentOnDay(member, plannerState, day)) {
            return CandidateRejectionReason.OVERLAP;
        }
        if (overlapsExistingAssignment(member, plannerState, day, option.getStartTime(), option.getEndTime())) {
            return CandidateRejectionReason.OVERLAP;
        }
        if (violatesMinRest(member, config, plannerState, day, option.getStartTime(), option.getEndTime())) {
            return CandidateRejectionReason.MIN_REST;
        }
        return CandidateRejectionReason.NONE;
    }

    private boolean violatesMaxShifts(
            RestaurantMember member,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState
    ) {
        Integer maxShiftsPerPeriod = config.getMaxShiftsPerPeriod();
        if (maxShiftsPerPeriod == null) {
            return false;
        }
        return plannerState.shiftsCount(member.getId()) >= maxShiftsPerPeriod;
    }

    private boolean hasAssignmentOnDay(RestaurantMember member, PlannerState plannerState, LocalDate day) {
        return plannerState.assignedIntervals(member.getId()).stream()
                .anyMatch(interval -> day.equals(interval.day()));
    }

    private boolean overlapsExistingAssignment(
            RestaurantMember member,
            PlannerState plannerState,
            LocalDate day,
            LocalTime startTime,
            LocalTime endTime
    ) {
        long candidateStart = toAbsoluteMinute(day, startTime, false, startTime);
        long candidateEnd = toAbsoluteMinute(day, endTime, true, startTime);

        return plannerState.assignedIntervals(member.getId()).stream()
                .anyMatch(interval -> overlaps(
                        candidateStart,
                        candidateEnd,
                        interval.startAbsoluteMinute(),
                        interval.endAbsoluteMinute()
                ));
    }

    private boolean violatesMinRest(
            RestaurantMember member,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            LocalDate day,
            LocalTime startTime,
            LocalTime endTime
    ) {
        Integer minRestHours = config.getMinRestHours();
        if (minRestHours == null) {
            return false;
        }
        return !hasEnoughRest(
                plannerState.assignedIntervals(member.getId()),
                day,
                startTime,
                endTime,
                minRestHours
        );
    }

    private boolean hasEnoughRest(
            List<AssignedInterval> existingAssignments,
            LocalDate candidateDay,
            LocalTime shiftStart,
            LocalTime shiftEnd,
            int minRestHours
    ) {
        long requiredRestMinutes = (long) minRestHours * 60;
        long candidateStart = toAbsoluteMinute(candidateDay, shiftStart, false, shiftStart);
        long candidateEnd = toAbsoluteMinute(candidateDay, shiftEnd, true, shiftStart);

        for (AssignedInterval interval : existingAssignments) {
            if (candidateStart >= interval.endAbsoluteMinute()) {
                long restMinutes = candidateStart - interval.endAbsoluteMinute();
                if (restMinutes < requiredRestMinutes) {
                    return false;
                }
            } else if (interval.startAbsoluteMinute() >= candidateEnd) {
                long restMinutes = interval.startAbsoluteMinute() - candidateEnd;
                if (restMinutes < requiredRestMinutes) {
                    return false;
                }
            }
        }

        return true;
    }

    private CandidateEvaluation selectBestCandidate(List<CandidateEvaluation> candidates) {
        return candidates.stream()
                .min((left, right) -> {
                    int byMatchStatus = Integer.compare(matchStatusRank(left.matchStatus()), matchStatusRank(right.matchStatus()));
                    if (byMatchStatus != 0) {
                        return byMatchStatus;
                    }

                    int byShiftsCount = Integer.compare(left.shiftsCount(), right.shiftsCount());
                    if (byShiftsCount != 0) {
                        return byShiftsCount;
                    }

                    int byDisplayName = left.displayName().compareToIgnoreCase(right.displayName());
                    if (byDisplayName != 0) {
                        return byDisplayName;
                    }

                    return Long.compare(left.member().getId(), right.member().getId());
                })
                .orElse(null);
    }

    private void registerAssignment(
            PlannerState plannerState,
            RestaurantMember member,
            LocalDate day,
            ScheduleBuildShiftOption option
    ) {
        plannerState.register(member.getId(), new AssignedInterval(day, option.getStartTime(), option.getEndTime()));
    }

    private String unfilledWarning(
            LocalDate day,
            ScheduleBuildShiftOption option,
            CandidateSelectionResult selection
    ) {
        if (selection.maxShiftsRejectedCount() > 0
                && selection.minRestRejectedCount() == 0
                && selection.overlapRejectedCount() == 0) {
            return "Недостаточно сотрудников с учётом лимита смен за период";
        }
        if (selection.hasHardConstraintRejections()) {
            return "Недостаточно сотрудников для покрытия "
                    + day
                    + " "
                    + formatShift(option)
                    + " с учётом ограничений";
        }
        return "Недостаточно сотрудников для покрытия " + day + " " + formatShift(option);
    }

    private String reasonFor(List<String> warnings, MatchStatus matchStatus) {
        if (matchStatus == MatchStatus.EXACT_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.COVERING_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.FULL_DAY_POSITIVE) {
            return "Подходит по пожеланию";
        }

        if (matchStatus == MatchStatus.NEGATIVE_FALLBACK) {
            warnings.add("Есть отрицательное пожелание на этот день");
            return "Поставлен для покрытия потребности";
        }

        return "Нет пожелания, выбран по доступности";
    }

    private String warningMessageFor(MatchStatus matchStatus) {
        if (matchStatus == MatchStatus.NEGATIVE_FALLBACK) {
            return "Сотрудник назначен несмотря на отрицательное пожелание, потому что не найдено альтернатив.";
        }
        return null;
    }

    private PreferenceGrade grade(MatchStatus matchStatus) {
        if (matchStatus == MatchStatus.EXACT_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.COVERING_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.FULL_DAY_POSITIVE) {
            return PreferenceGrade.POSITIVE;
        }
        if (matchStatus == MatchStatus.NEGATIVE_FALLBACK) {
            return PreferenceGrade.NEGATIVE;
        }
        return PreferenceGrade.NONE;
    }

    private MatchStatus matchStatusFor(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option) {
        List<SchedulePreferenceCell> dayCells = cells.stream()
                .filter(cell -> cell != null && day.equals(cell.getDay()))
                .toList();

        if (dayCells.isEmpty()) {
            return MatchStatus.NO_PREFERENCE;
        }

        boolean hasExactPositive = dayCells.stream().anyMatch(cell -> isExactPositiveForShift(cell, option));
        if (hasExactPositive) {
            return MatchStatus.EXACT_INTERVAL_PREFERENCE;
        }

        boolean hasCoveringPositive = dayCells.stream().anyMatch(cell -> isCoveringPositiveForShift(cell, option));
        if (hasCoveringPositive) {
            return MatchStatus.COVERING_INTERVAL_PREFERENCE;
        }

        boolean hasFullDayPositive = dayCells.stream().anyMatch(this::isFullDayPositive);
        if (hasFullDayPositive) {
            return MatchStatus.FULL_DAY_POSITIVE;
        }

        boolean hasNegative = dayCells.stream().anyMatch(cell -> isNegativeForShift(cell, option));
        if (hasNegative) {
            return MatchStatus.NEGATIVE_FALLBACK;
        }

        return MatchStatus.NO_PREFERENCE;
    }

    private boolean isFullDayPositive(SchedulePreferenceCell cell) {
        return cell.isFullDay() && isPositiveType(cell.getType());
    }

    private boolean isExactPositiveForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option) {
        if (!isPositiveType(cell.getType()) || cell.isFullDay()) {
            return false;
        }
        if (cell.getStartTime() == null || cell.getEndTime() == null) {
            return false;
        }

        return intervalsEqual(
                cell.getStartTime(),
                cell.getEndTime(),
                option.getStartTime(),
                option.getEndTime()
        );
    }

    private boolean isCoveringPositiveForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option) {
        if (!isPositiveType(cell.getType()) || cell.isFullDay()) {
            return false;
        }
        if (cell.getStartTime() == null || cell.getEndTime() == null) {
            return false;
        }
        return coversInterval(cell.getStartTime(), cell.getEndTime(), option.getStartTime(), option.getEndTime())
                && !intervalsEqual(cell.getStartTime(), cell.getEndTime(), option.getStartTime(), option.getEndTime());
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

        return intervalsEqual(
                cell.getStartTime(),
                cell.getEndTime(),
                option.getStartTime(),
                option.getEndTime()
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

    private ScheduleBuildShiftOption findExactShiftOption(List<ScheduleBuildShiftOption> options, ScheduleBuildCoverageRule rule) {
        for (ScheduleBuildShiftOption option : options) {
            if (intervalsEqual(option.getStartTime(), option.getEndTime(), rule.getStartTime(), rule.getEndTime())) {
                return option;
            }
        }
        return null;
    }

    private ScheduleBuildShiftOption findShiftOption(List<ScheduleBuildShiftOption> options, ScheduleBuildCoverageRule rule) {
        for (ScheduleBuildShiftOption option : options) {
            boolean exactMatch = intervalsEqual(
                    option.getStartTime(),
                    option.getEndTime(),
                    rule.getStartTime(),
                    rule.getEndTime()
            );
            if (exactMatch) {
                return option;
            }
        }

        for (ScheduleBuildShiftOption option : options) {
            boolean containsRuleInterval = coversInterval(
                    option.getStartTime(),
                    option.getEndTime(),
                    rule.getStartTime(),
                    rule.getEndTime()
            );
            if (containsRuleInterval) {
                return option;
            }
        }

        return null;
    }

    private String missingShiftOptionWarning(
            ScheduleBuildPositionConfig config,
            ScheduleBuildCoverageRule rule,
            List<ScheduleBuildShiftOption> shiftOptions
    ) {
        if (shiftOptions.isEmpty()) {
            return "Для должности " + config.getPosition().getName() + " не настроены варианты смен";
        }

        return "Не найден shiftOption для правила "
                + formatInterval(rule.getStartTime(), rule.getEndTime())
                + ". Доступные варианты: "
                + shiftOptions.stream()
                .map(option -> formatInterval(option.getStartTime(), option.getEndTime()))
                .distinct()
                .collect(Collectors.joining(", "));
    }

    private String formatInterval(LocalTime startTime, LocalTime endTime) {
        return startTime.format(HH_MM) + "-" + endTime.format(HH_MM);
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
        return formatInterval(option.getStartTime(), option.getEndTime());
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

    private boolean overlaps(long startA, long endA, long startB, long endB) {
        return startA < endB && startB < endA;
    }

    private long toAbsoluteMinute(LocalDate day, LocalTime time, boolean endTime, LocalTime shiftStart) {
        long dayStart = day.toEpochDay() * END_OF_DAY_MINUTES;
        int minute = toMinute(time, endTime);
        if (endTime && minute <= toMinute(shiftStart, false)) {
            return dayStart + END_OF_DAY_MINUTES + minute;
        }
        return dayStart + minute;
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

    private DayBuildResult buildLegacyAssignmentsForDay(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            PlannerState plannerState
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        int negativeAssignmentsCount = 0;

        for (ScheduleBuildShiftOption option : safeShiftOptions(config)) {
            CandidateSelectionResult selection = pickMember(candidates, preferencesByMember, day, option, config, plannerState);
            if (selection.selected() == null) {
                continue;
            }

            RestaurantMember selected = selection.selected().member();
            List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(selected.getId(), List.of());
            AssignmentBuildResult assignmentResult = createAssignment(selected, day, option, memberCells);
            assignments.add(assignmentResult.assignment());
            if (assignmentResult.grade() == PreferenceGrade.NEGATIVE) {
                negativeAssignmentsCount++;
            }
            registerAssignment(plannerState, selected, day, option);
        }

        return new DayBuildResult(assignments, warnings, List.of(), 0, negativeAssignmentsCount);
    }

    private UncoveredSlotPlan toUncoveredSlot(
            LocalDate day,
            Long positionId,
            LocalTime startTime,
            LocalTime endTime,
            int requiredCount,
            int assignedCount
    ) {
        return new UncoveredSlotPlan(
                day.toString(),
                positionId,
                startTime.format(HH_MM),
                endTime.format(HH_MM),
                requiredCount,
                assignedCount
        );
    }

    private Map<Long, List<SchedulePreferenceCell>> loadPreferencesByMember(Long scheduleId) {
        return submissions.findWithCellsByScheduleId(scheduleId).stream()
                .filter(submission -> submission.getMember() != null)
                .collect(Collectors.toMap(
                        submission -> submission.getMember().getId(),
                        submission -> submission.getCells() == null ? List.of() : submission.getCells(),
                        (left, right) -> left
                ));
    }


    private static final class PlannerState {
        private final Map<Long, Integer> shiftsCountByMember = new HashMap<>();
        private final Map<Long, List<AssignedInterval>> assignedIntervalsByMember = new HashMap<>();

        private int shiftsCount(Long memberId) {
            return shiftsCountByMember.getOrDefault(memberId, 0);
        }

        private List<AssignedInterval> assignedIntervals(Long memberId) {
            return assignedIntervalsByMember.getOrDefault(memberId, List.of());
        }

        private void register(Long memberId, AssignedInterval interval) {
            shiftsCountByMember.merge(memberId, 1, Integer::sum);
            assignedIntervalsByMember.computeIfAbsent(memberId, ignored -> new ArrayList<>()).add(interval);
        }

        private PlannerState copy() {
            PlannerState copy = new PlannerState();
            copy.shiftsCountByMember.putAll(shiftsCountByMember);
            assignedIntervalsByMember.forEach((memberId, intervals) ->
                    copy.assignedIntervalsByMember.put(memberId, new ArrayList<>(intervals))
            );
            return copy;
        }

        private void replaceWith(PlannerState other) {
            shiftsCountByMember.clear();
            shiftsCountByMember.putAll(other.shiftsCountByMember);
            assignedIntervalsByMember.clear();
            other.assignedIntervalsByMember.forEach((memberId, intervals) ->
                    assignedIntervalsByMember.put(memberId, new ArrayList<>(intervals))
            );
        }
    }

    private static final class AssignedInterval {
        private final LocalDate day;
        private final LocalTime startTime;
        private final LocalTime endTime;
        private final long startAbsoluteMinute;
        private final long endAbsoluteMinute;

        private AssignedInterval(LocalDate day, LocalTime startTime, LocalTime endTime) {
            this.day = day;
            this.startTime = startTime;
            this.endTime = endTime;
            this.startAbsoluteMinute = day.toEpochDay() * END_OF_DAY_MINUTES
                    + startTime.getHour() * 60L
                    + startTime.getMinute();
            long endMinute = LocalTime.MIDNIGHT.equals(endTime)
                    ? END_OF_DAY_MINUTES
                    : endTime.getHour() * 60L + endTime.getMinute();
            long startMinute = startTime.getHour() * 60L + startTime.getMinute();
            if (endMinute <= startMinute) {
                endMinute += END_OF_DAY_MINUTES;
            }
            this.endAbsoluteMinute = day.toEpochDay() * END_OF_DAY_MINUTES + endMinute;
        }

        private LocalDate day() {
            return day;
        }

        private LocalTime startTime() {
            return startTime;
        }

        private LocalTime endTime() {
            return endTime;
        }

        private long startAbsoluteMinute() {
            return startAbsoluteMinute;
        }

        private long endAbsoluteMinute() {
            return endAbsoluteMinute;
        }
    }

    private enum CandidateRejectionReason {
        NONE,
        MAX_SHIFTS,
        MIN_REST,
        OVERLAP
    }

    private enum PreferenceGrade {
        POSITIVE,
        NONE,
        NEGATIVE
    }

    private enum MatchStatus {
        EXACT_INTERVAL_PREFERENCE,
        COVERING_INTERVAL_PREFERENCE,
        FULL_DAY_POSITIVE,
        NO_PREFERENCE,
        NEGATIVE_FALLBACK
    }


    private record CandidateEvaluation(
            RestaurantMember member,
            MatchStatus matchStatus,
            PreferenceGrade grade,
            int shiftsCount,
            String displayName,
            boolean eligible,
            CandidateRejectionReason rejectionReason
    ) {
    }

    private record CandidateSelectionResult(
            CandidateEvaluation selected,
            int maxShiftsRejectedCount,
            int minRestRejectedCount,
            int overlapRejectedCount
    ) {
        private static CandidateSelectionResult empty() {
            return new CandidateSelectionResult(null, 0, 0, 0);
        }

        private boolean hasHardConstraintRejections() {
            return maxShiftsRejectedCount > 0 || minRestRejectedCount > 0 || overlapRejectedCount > 0;
        }
    }

    private record SplitOptionSelection(
            ScheduleBuildShiftOption option,
            CandidateSelectionResult selection
    ) {
    }

    private record CoverageLayerResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            List<UncoveredSlotPlan> uncoveredSlots,
            int unfilledCount,
            int negativeAssignmentsCount,
            boolean isComplete
    ) {
    }

    private record DayBuildResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            List<UncoveredSlotPlan> uncoveredSlots,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }

    private record CoverageRuleResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            List<UncoveredSlotPlan> uncoveredSlots,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }

    private record PositionBuildResult(PositionPlan positionPlan, List<UncoveredSlotPlan> uncoveredSlots) {
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
