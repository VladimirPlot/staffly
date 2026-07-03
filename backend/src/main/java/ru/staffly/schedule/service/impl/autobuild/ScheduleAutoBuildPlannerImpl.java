package ru.staffly.schedule.service.impl.autobuild;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildCoverageRule;
import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
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
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.RejectionHintPlan;
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
                .flatMap(config -> configPositionIds(config).stream())
                .collect(Collectors.toSet());

        for (ScheduleBuildPositionConfig config : positionConfigs) {
            if (disjoint(configPositionIds(config), schedulePositions)) {
                topWarnings.add("В шаблоне есть блок должностей вне графика: " + configDisplayName(config));
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
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();

        for (ScheduleBuildPositionConfig config : positionConfigs) {
            if (disjoint(configPositionIds(config), schedulePositions)) {
                continue;
            }
            PositionBuildResult positionResult = buildPosition(restaurantId, schedule, config, preferencesByMember, plannerState);
            positions.add(positionResult.positionPlan());
            uncoveredSlots.addAll(positionResult.uncoveredSlots());
            rejectionHints.addAll(positionResult.rejectionHints());
        }

        List<String> distinctTopWarnings = topWarnings.stream().distinct().toList();
        Set<Long> affected = positions.stream().flatMap(position -> position.positionIds().stream()).collect(Collectors.toSet());
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
                rejectionHints.stream().distinct().toList(),
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
        List<Long> effectivePositionIds = intersection(configPositionIds(config), schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds());
        List<RestaurantMember> candidates = loadCandidates(restaurantId, effectivePositionIds);
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();

        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;
        double targetShiftsPerCandidate = targetShiftsPerCandidate(schedule, config, candidates);

        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            DayBuildResult dayResult = buildAssignmentsForDay(
                    day,
                    config,
                    candidates,
                    preferencesByMember,
                    plannerState,
                    targetShiftsPerCandidate
            );
            assignments.addAll(dayResult.assignments());
            warnings.addAll(dayResult.warnings());
            uncoveredSlots.addAll(dayResult.uncoveredSlots());
            rejectionHints.addAll(dayResult.rejectionHints());
            unfilledCount += dayResult.unfilledCount();
            negativeAssignmentsCount += dayResult.negativeAssignmentsCount();
        }

        PositionCounters counters = buildPositionCounters(assignments, warnings, unfilledCount, negativeAssignmentsCount);

        PositionPlan positionPlan = new PositionPlan(
                config.getId(),
                effectiveConfigDisplayName(config, effectivePositionIds),
                effectivePositionIds,
                assignments,
                counters.distinctWarnings(),
                counters.totalAssignments(),
                counters.warningsCount(),
                counters.unfilledCount(),
                counters.negativeAssignmentsCount()
        );
        return new PositionBuildResult(positionPlan, uncoveredSlots, rejectionHints);
    }

    private List<RestaurantMember> loadCandidates(Long restaurantId, List<Long> positionIds) {
        List<RestaurantMember> foundMembers = members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                restaurantId,
                positionIds
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
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();
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
                    plannerState,
                    targetShiftsPerCandidate
            );

            assignments.addAll(ruleResult.assignments());
            warnings.addAll(ruleResult.warnings());
            uncoveredSlots.addAll(ruleResult.uncoveredSlots());
            rejectionHints.addAll(ruleResult.rejectionHints());
            unfilledCount += ruleResult.unfilledCount();
            negativeAssignmentsCount += ruleResult.negativeAssignmentsCount();
        }

        return new DayBuildResult(assignments, warnings, uncoveredSlots, rejectionHints, unfilledCount, negativeAssignmentsCount);
    }

    private CoverageRuleResult buildAssignmentForCoverageRule(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            ScheduleBuildCoverageRule rule,
            List<RestaurantMember> candidates,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();
        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        int requiredCount = safeRequiredCount(rule);
        List<ScheduleBuildShiftOption> shiftOptions = safeShiftOptions(config);
        ScheduleBuildShiftOption singleOption = findExactShiftOption(shiftOptions, rule);

        for (int index = 0; index < requiredCount; index++) {
            CandidateSelectionResult singleSelection = CandidateSelectionResult.empty();
            if (singleOption != null) {
                singleSelection = pickMember(
                        candidates,
                        preferencesByMember,
                        day,
                        singleOption,
                        config,
                        plannerState,
                        targetShiftsPerCandidate
                );
                rejectionHints.addAll(singleSelection.rejectionHints());

                CandidateEvaluation selectedSingle = singleSelection.selected();
                if (selectedSingle != null && isGoodSingleMatch(selectedSingle.matchStatus())) {
                    AssignmentBuildResult assignmentResult = assignSelected(
                            assignments,
                            plannerState,
                            selectedSingle.member(),
                            day,
                            singleOption,
                            preferencesByMember,
                            config
                    );
                    if (isNegativeGrade(assignmentResult.grade())) {
                        negativeAssignmentsCount++;
                    }
                    continue;
                }
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
                    true,
                    targetShiftsPerCandidate
            );
            if (positiveSplitResult.isComplete()) {
                assignments.addAll(positiveSplitResult.assignments());
                warnings.addAll(positiveSplitResult.warnings());
                uncoveredSlots.addAll(positiveSplitResult.uncoveredSlots());
                rejectionHints.addAll(positiveSplitResult.rejectionHints());
                unfilledCount += positiveSplitResult.unfilledCount();
                negativeAssignmentsCount += positiveSplitResult.negativeAssignmentsCount();
                continue;
            }

            if (singleOption != null && singleSelection.selected() != null) {
                AssignmentBuildResult assignmentResult = assignSelected(
                        assignments,
                        plannerState,
                        singleSelection.selected().member(),
                        day,
                        singleOption,
                        preferencesByMember,
                        config
                );
                if (isNegativeGrade(assignmentResult.grade())) {
                    negativeAssignmentsCount++;
                }
                continue;
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
                    false,
                    targetShiftsPerCandidate
            );
            assignments.addAll(layerResult.assignments());
            warnings.addAll(layerResult.warnings());
            uncoveredSlots.addAll(layerResult.uncoveredSlots());
            rejectionHints.addAll(layerResult.rejectionHints());
            unfilledCount += layerResult.unfilledCount();
            negativeAssignmentsCount += layerResult.negativeAssignmentsCount();
        }

        return new CoverageRuleResult(assignments, warnings, uncoveredSlots, rejectionHints, unfilledCount, negativeAssignmentsCount);
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
            boolean requireComplete,
            double targetShiftsPerCandidate
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();
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
                    allowNegativeAssignments,
                    targetShiftsPerCandidate
            );

            rejectionHints.addAll(splitSelection.selection().rejectionHints());
            if (splitSelection.option() == null || splitSelection.selection().selected() == null) {
                int nextBoundary = nextCoverageBoundary(shiftOptions, rule, cursor, ruleEnd);
                LocalTime uncoveredStart = minuteToTime(cursor);
                LocalTime uncoveredEnd = minuteToTime(nextBoundary);
                ScheduleBuildShiftOption warningOption = ScheduleBuildShiftOption.builder()
                        .startTime(uncoveredStart)
                        .endTime(uncoveredEnd)
                        .build();
                warnings.add(unfilledWarning(day, warningOption, splitSelection.selection()));
                uncoveredSlots.add(toUncoveredSlot(day, config.getId(), configPositionIds(config), configDisplayName(config), uncoveredStart, uncoveredEnd, 1, 0));
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
                    preferencesByMember,
                    config
            );
            if (isNegativeGrade(assignmentResult.grade())) {
                negativeAssignmentsCount++;
            }
            cursor = Math.max(cursor + 1, toMinute(option.getEndTime(), true));
        }

        boolean complete = uncoveredSlots.isEmpty() && cursor >= ruleEnd;
        if (requireComplete && !complete) {
            return new CoverageLayerResult(List.of(), List.of(), List.of(), List.of(), 0, 0, false);
        }
        if (requireComplete) {
            plannerState.replaceWith(workingState);
        }

        return new CoverageLayerResult(assignments, warnings, uncoveredSlots, rejectionHints, unfilledCount, negativeAssignmentsCount, complete);
    }

    private AssignmentBuildResult assignSelected(
            List<AssignmentPlan> assignments,
            PlannerState plannerState,
            RestaurantMember selected,
            LocalDate day,
            ScheduleBuildShiftOption option,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            ScheduleBuildPositionConfig config
    ) {
        List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(selected.getId(), List.of());
        boolean minRestViolation = !isStrictMinRest(config) && violatesMinRest(selected, config, plannerState, day, option.getStartTime(), option.getEndTime());
        AssignmentBuildResult assignmentResult = createAssignment(selected, day, option, memberCells, minRestViolation, config.getMinRestHours());
        assignments.add(assignmentResult.assignment());
        registerAssignment(plannerState, selected, day, option, config);
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
            boolean allowNegativeAssignments,
            double targetShiftsPerCandidate
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
            CandidateSelectionResult selection = pickMember(candidates, preferencesByMember, day, option, config, plannerState, targetShiftsPerCandidate);
            if (!allowNegativeAssignments && selection.selected() != null && isNegativeGrade(selection.selected().grade())) {
                selection = new CandidateSelectionResult(
                        null,
                        selection.maxShiftsRejectedCount(),
                        selection.minRestRejectedCount(),
                        selection.overlapRejectedCount(),
                        selection.rejectionHints()
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


    private int candidateRank(CandidateEvaluation candidate) {
        return matchStatusRank(candidate.matchStatus());
    }

    private int matchStatusRank(MatchStatus matchStatus) {
        return switch (matchStatus) {
            case EXACT_INTERVAL_PREFERENCE -> 0;
            case COVERING_INTERVAL_PREFERENCE -> 1;
            case FULL_DAY_POSITIVE, NO_PREFERENCE -> 2;
            case PARTIAL_INTERVAL_FALLBACK -> 4;
            case SOFT_NEGATIVE_FALLBACK -> 5;
            case HARD_NEGATIVE_FALLBACK -> 6;
        };
    }

    private int gradeRank(PreferenceGrade grade) {
        return switch (grade) {
            case POSITIVE -> 0;
            case NONE -> 1;
            case FALLBACK -> 2;
            case SOFT_NEGATIVE -> 3;
            case HARD_NEGATIVE -> 4;
        };
    }

    private boolean isGoodSingleMatch(MatchStatus matchStatus) {
        return matchStatus == MatchStatus.EXACT_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.COVERING_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.FULL_DAY_POSITIVE
                || matchStatus == MatchStatus.NO_PREFERENCE;
    }

    private boolean isNegativeGrade(PreferenceGrade grade) {
        return grade == PreferenceGrade.SOFT_NEGATIVE || grade == PreferenceGrade.HARD_NEGATIVE;
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
            List<SchedulePreferenceCell> memberCells,
            boolean minRestViolation,
            Integer minRestHours
    ) {
        List<String> cellWarnings = new ArrayList<>();
        MatchStatus matchStatus = matchStatusFor(memberCells, day, option);
        PreferenceGrade grade = grade(matchStatus);
        String reason = reasonFor(cellWarnings, matchStatus);
        String warningMessage = warningMessageFor(matchStatus);
        if (minRestViolation) {
            cellWarnings.add("Мало отдыха");
            warningMessage = "Между сменами меньше " + minRestHours + " часов отдыха.";
        }

        AssignmentPlan assignment = new AssignmentPlan(
                member.getId(),
                displayName(member),
                member.getPosition() == null ? null : member.getPosition().getId(),
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
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        List<CandidateEvaluation> eligibleCandidates = new ArrayList<>();
        int maxShiftsRejectedCount = 0;
        int minRestRejectedCount = 0;
        int overlapRejectedCount = 0;
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();

        for (RestaurantMember member : candidates) {
            CandidateEvaluation evaluation = evaluateCandidate(
                    member,
                    preferencesByMember,
                    day,
                    option,
                    config,
                    plannerState,
                    targetShiftsPerCandidate
            );
            if (!evaluation.eligible()) {
                if (evaluation.rejectionReason() == CandidateRejectionReason.MAX_SHIFTS) {
                    maxShiftsRejectedCount++;
                    toMaxShiftsRejectionHint(evaluation, preferencesByMember, day, option, config)
                            .ifPresent(rejectionHints::add);
                } else if (evaluation.rejectionReason() == CandidateRejectionReason.MIN_REST) {
                    minRestRejectedCount++;
                } else if (evaluation.rejectionReason() == CandidateRejectionReason.OVERLAP) {
                    overlapRejectedCount++;
                }
                continue;
            }

            eligibleCandidates.add(evaluation);
        }

        CandidateEvaluation selected = selectBestCandidate(eligibleCandidates);

        return new CandidateSelectionResult(
                selected,
                maxShiftsRejectedCount,
                minRestRejectedCount,
                overlapRejectedCount,
                rejectionHints
        );
    }

    private CandidateEvaluation evaluateCandidate(
            RestaurantMember member,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        int shiftsCount = plannerState.shiftsCount(member.getId());
        String displayName = displayName(member);
        boolean minRestViolation = violatesMinRest(member, config, plannerState, day, option.getStartTime(), option.getEndTime());
        List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(member.getId(), List.of());
        MatchStatus matchStatus = matchStatusFor(memberCells, day, option);
        PreferenceGrade memberGrade = grade(matchStatus);
        CandidateRejectionReason rejectionReason = hardConstraintRejectionReason(
                member,
                day,
                option,
                config,
                plannerState,
                minRestViolation
        );

        if (rejectionReason != CandidateRejectionReason.NONE) {
            return new CandidateEvaluation(
                    member,
                    matchStatus,
                    memberGrade,
                    shiftsCount,
                    displayName,
                    fairnessScore(member, day, config, plannerState, targetShiftsPerCandidate),
                    false,
                    minRestViolation,
                    rejectionReason
            );
        }

        return new CandidateEvaluation(
                member,
                matchStatus,
                memberGrade,
                shiftsCount,
                displayName,
                fairnessScore(member, day, config, plannerState, targetShiftsPerCandidate),
                true,
                minRestViolation,
                CandidateRejectionReason.NONE
        );
    }

    private Optional<RejectionHintPlan> toMaxShiftsRejectionHint(
            CandidateEvaluation evaluation,
            Map<Long, List<SchedulePreferenceCell>> preferencesByMember,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config
    ) {
        List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(evaluation.member().getId(), List.of());
        if (hasNegativePreferenceOnDay(memberCells, day)) {
            return Optional.empty();
        }
        if (evaluation.grade() != PreferenceGrade.POSITIVE && evaluation.grade() != PreferenceGrade.NONE) {
            return Optional.empty();
        }

        return Optional.of(new RejectionHintPlan(
                evaluation.member().getId(),
                evaluation.displayName(),
                day.toString(),
                config.getId(),
                configDisplayName(config),
                option.getId(),
                option.getLabel(),
                option.getStartTime().toString(),
                option.getEndTime().toString(),
                "MAX_SHIFTS_LIMIT",
                "Достигнут лимит смен за период"
        ));
    }

    private boolean hasNegativePreferenceOnDay(List<SchedulePreferenceCell> cells, LocalDate day) {
        return cells.stream().anyMatch(cell -> cell != null
                && day.equals(cell.getDay())
                && (cell.getType() == SchedulePreferenceType.UNAVAILABLE
                || cell.getType() == SchedulePreferenceType.PREFER_DAY_OFF));
    }

    private CandidateRejectionReason hardConstraintRejectionReason(
            RestaurantMember member,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            boolean minRestViolation
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
        if (isStrictMinRest(config) && minRestViolation) {
            return CandidateRejectionReason.MIN_REST;
        }
        return CandidateRejectionReason.NONE;
    }


    private boolean isStrictMinRest(ScheduleBuildPositionConfig config) {
        return config.getMinRestMode() == ScheduleBuildMinRestMode.STRICT;
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
        if (minRestHours == null || minRestHours <= 0) {
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

    private double targetShiftsPerCandidate(
            Schedule schedule,
            ScheduleBuildPositionConfig config,
            List<RestaurantMember> candidates
    ) {
        if (candidates.isEmpty()) {
            return 0;
        }

        int totalRequiredAssignments = 0;
        List<ScheduleBuildCoverageRule> coverageRules = safeCoverageRules(config);
        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            int dayOfWeek = day.getDayOfWeek().getValue();
            totalRequiredAssignments += coverageRules.stream()
                    .filter(rule -> rule.getDayOfWeek() == dayOfWeek)
                    .mapToInt(this::safeRequiredCount)
                    .sum();
        }

        return (double) totalRequiredAssignments / candidates.size();
    }

    private int fairnessScore(
            RestaurantMember member,
            LocalDate day,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        int shiftsCount = plannerState.shiftsCount(member.getId());
        int score = shiftsCount * 100;
        if (targetShiftsPerCandidate > 0 && shiftsCount >= targetShiftsPerCandidate) {
            score += 75 + (int) Math.round((shiftsCount - targetShiftsPerCandidate) * 25);
        }

        int previousConsecutiveDays = previousConsecutiveWorkDays(member, day, plannerState);
        if (previousConsecutiveDays == 2) {
            score += 20;
        } else if (previousConsecutiveDays >= 3) {
            score += 60 + (previousConsecutiveDays - 3) * 20;
        }

        if (hasAssignmentOnDay(member, plannerState, day.minusDays(2))
                && !hasAssignmentOnDay(member, plannerState, day.minusDays(1))) {
            score += 10;
        }

        if (isHeavyDay(config, day)) {
            score += plannerState.heavyDaysCount(member.getId(), configKey(config)) * 30;
        }

        return score;
    }

    private int previousConsecutiveWorkDays(RestaurantMember member, LocalDate day, PlannerState plannerState) {
        int count = 0;
        LocalDate cursor = day.minusDays(1);
        while (hasAssignmentOnDay(member, plannerState, cursor)) {
            count++;
            cursor = cursor.minusDays(1);
        }
        return count;
    }

    private boolean isHeavyDay(ScheduleBuildPositionConfig config, LocalDate day) {
        List<Integer> heavyDaysOfWeek = config.getHeavyDaysOfWeek();
        return heavyDaysOfWeek != null && heavyDaysOfWeek.contains(day.getDayOfWeek().getValue());
    }

    private String configKey(ScheduleBuildPositionConfig config) {
        if (config.getId() != null) {
            return "config:" + config.getId();
        }
        return "positions:" + configPositionIds(config).stream().map(String::valueOf).collect(Collectors.joining(","));
    }

    private CandidateEvaluation selectBestCandidate(List<CandidateEvaluation> candidates) {
        return candidates.stream()
                .min((left, right) -> {
                    int byMatchStatus = Integer.compare(candidateRank(left), candidateRank(right));
                    if (byMatchStatus != 0) {
                        return byMatchStatus;
                    }

                    // Keep conflict severity as the primary boundary: min-rest and fairness
                    // only break ties within the same match status priority group.
                    int byMinRestViolation = Boolean.compare(left.minRestViolation(), right.minRestViolation());
                    if (byMinRestViolation != 0) {
                        return byMinRestViolation;
                    }

                    int byFairnessScore = Integer.compare(left.fairnessScore(), right.fairnessScore());
                    if (byFairnessScore != 0) {
                        return byFairnessScore;
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
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config
    ) {
        plannerState.register(member.getId(), new AssignedInterval(day, option.getStartTime(), option.getEndTime()));
        if (isHeavyDay(config, day)) {
            plannerState.registerHeavyDay(member.getId(), configKey(config));
        }
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

        if (matchStatus == MatchStatus.PARTIAL_INTERVAL_FALLBACK) {
            warnings.add("Назначение частично выходит за пределы пожелания сотрудника");
            return "Частично совпадает с пожеланием";
        }

        if (matchStatus == MatchStatus.SOFT_NEGATIVE_FALLBACK) {
            warnings.add("Сотрудник предпочитал выходной в это время");
            return "Поставлен несмотря на предпочтение выходного";
        }

        if (matchStatus == MatchStatus.HARD_NEGATIVE_FALLBACK) {
            warnings.add("Сотрудник указал, что не может работать в это время");
            return "Поставлен вопреки недоступности";
        }

        return "Нет пожелания, выбран по доступности";
    }

    private String warningMessageFor(MatchStatus matchStatus) {
        if (matchStatus == MatchStatus.PARTIAL_INTERVAL_FALLBACK) {
            return "Назначение частично выходит за пределы пожелания сотрудника.";
        }
        if (matchStatus == MatchStatus.SOFT_NEGATIVE_FALLBACK) {
            return "Сотрудник предпочитал выходной в это время.";
        }
        if (matchStatus == MatchStatus.HARD_NEGATIVE_FALLBACK) {
            return "Сотрудник указал, что не может работать в это время.";
        }
        return null;
    }

    private PreferenceGrade grade(MatchStatus matchStatus) {
        if (matchStatus == MatchStatus.EXACT_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.COVERING_INTERVAL_PREFERENCE
                || matchStatus == MatchStatus.FULL_DAY_POSITIVE) {
            return PreferenceGrade.POSITIVE;
        }
        if (matchStatus == MatchStatus.PARTIAL_INTERVAL_FALLBACK) {
            return PreferenceGrade.FALLBACK;
        }
        if (matchStatus == MatchStatus.SOFT_NEGATIVE_FALLBACK) {
            return PreferenceGrade.SOFT_NEGATIVE;
        }
        if (matchStatus == MatchStatus.HARD_NEGATIVE_FALLBACK) {
            return PreferenceGrade.HARD_NEGATIVE;
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

        boolean hasHardNegative = dayCells.stream().anyMatch(cell -> isHardNegativeForShift(cell, option));
        if (hasHardNegative) {
            return MatchStatus.HARD_NEGATIVE_FALLBACK;
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

        boolean hasPartialPositiveOverlap = hasPartialPositiveOverlap(dayCells, day, option);
        if (hasPartialPositiveOverlap) {
            return MatchStatus.PARTIAL_INTERVAL_FALLBACK;
        }

        boolean hasSoftNegative = dayCells.stream().anyMatch(cell -> isSoftNegativeForShift(cell, option));
        if (hasSoftNegative) {
            return MatchStatus.SOFT_NEGATIVE_FALLBACK;
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

    private boolean isSoftNegativeForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option) {
        return isNegativeForShift(cell, option, SchedulePreferenceType.PREFER_DAY_OFF);
    }

    private boolean isHardNegativeForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option) {
        return isNegativeForShift(cell, option, SchedulePreferenceType.UNAVAILABLE);
    }

    private boolean isNegativeForShift(SchedulePreferenceCell cell, ScheduleBuildShiftOption option, SchedulePreferenceType negativeType) {
        if (cell.getType() != negativeType) {
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
        return type == SchedulePreferenceType.AVAILABLE;
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
            return "Для блока должностей " + configDisplayName(config) + " не настроены варианты смен";
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
            Hibernate.initialize(positionConfig.getPositions());
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
            Hibernate.initialize(positionConfig.getHeavyDaysOfWeek());
        }
    }

    private List<Long> configPositionIds(ScheduleBuildPositionConfig config) {
        return config.getPositions() == null ? List.of() : config.getPositions().stream()
                .map(position -> position.getId())
                .filter(java.util.Objects::nonNull)
                .sorted()
                .toList();
    }

    private String configDisplayName(ScheduleBuildPositionConfig config) {
        return effectiveConfigDisplayName(config, configPositionIds(config));
    }

    private String effectiveConfigDisplayName(ScheduleBuildPositionConfig config, List<Long> effectivePositionIds) {
        Set<Long> effective = new java.util.HashSet<>(effectivePositionIds == null ? List.of() : effectivePositionIds);
        String name = config.getPositions() == null ? "" : config.getPositions().stream()
                .filter(position -> position.getId() != null && effective.contains(position.getId()))
                .sorted(java.util.Comparator
                        .comparing(Position::getName, java.util.Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Position::getId, java.util.Comparator.nullsLast(Long::compareTo)))
                .map(Position::getName)
                .collect(Collectors.joining(" + "));
        return name.isBlank() ? "Блок должностей" : name;
    }

    private List<Long> intersection(List<Long> left, List<Long> right) {
        Set<Long> rightSet = right == null ? Set.of() : new java.util.HashSet<>(right);
        return left.stream().filter(rightSet::contains).toList();
    }

    private boolean disjoint(List<Long> left, List<Long> right) {
        return intersection(left, right).isEmpty();
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
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();
        int negativeAssignmentsCount = 0;

        for (ScheduleBuildShiftOption option : safeShiftOptions(config)) {
            CandidateSelectionResult selection = pickMember(candidates, preferencesByMember, day, option, config, plannerState, 0);
            rejectionHints.addAll(selection.rejectionHints());
            if (selection.selected() == null) {
                continue;
            }

            RestaurantMember selected = selection.selected().member();
            List<SchedulePreferenceCell> memberCells = preferencesByMember.getOrDefault(selected.getId(), List.of());
            AssignmentBuildResult assignmentResult = createAssignment(selected, day, option, memberCells, false, null);
            assignments.add(assignmentResult.assignment());
            if (isNegativeGrade(assignmentResult.grade())) {
                negativeAssignmentsCount++;
            }
            registerAssignment(plannerState, selected, day, option, config);
        }

        return new DayBuildResult(assignments, warnings, List.of(), rejectionHints, 0, negativeAssignmentsCount);
    }

    private UncoveredSlotPlan toUncoveredSlot(
            LocalDate day,
            Long positionId,
            List<Long> positionIds,
            String positionName,
            LocalTime startTime,
            LocalTime endTime,
            int requiredCount,
            int assignedCount
    ) {
        return new UncoveredSlotPlan(
                day.toString(),
                positionId,
                positionIds,
                positionName,
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
        private final Map<Long, Map<String, Integer>> heavyDaysCountByMemberAndConfig = new HashMap<>();

        private int shiftsCount(Long memberId) {
            return shiftsCountByMember.getOrDefault(memberId, 0);
        }

        private List<AssignedInterval> assignedIntervals(Long memberId) {
            return assignedIntervalsByMember.getOrDefault(memberId, List.of());
        }

        private int heavyDaysCount(Long memberId, String configKey) {
            if (configKey == null) {
                return 0;
            }
            return heavyDaysCountByMemberAndConfig.getOrDefault(memberId, Map.of()).getOrDefault(configKey, 0);
        }

        private void register(Long memberId, AssignedInterval interval) {
            shiftsCountByMember.merge(memberId, 1, Integer::sum);
            assignedIntervalsByMember.computeIfAbsent(memberId, ignored -> new ArrayList<>()).add(interval);
        }

        private void registerHeavyDay(Long memberId, String configKey) {
            if (configKey == null) {
                return;
            }
            heavyDaysCountByMemberAndConfig
                    .computeIfAbsent(memberId, ignored -> new HashMap<>())
                    .merge(configKey, 1, Integer::sum);
        }

        private PlannerState copy() {
            PlannerState copy = new PlannerState();
            copy.shiftsCountByMember.putAll(shiftsCountByMember);
            assignedIntervalsByMember.forEach((memberId, intervals) ->
                    copy.assignedIntervalsByMember.put(memberId, new ArrayList<>(intervals))
            );
            heavyDaysCountByMemberAndConfig.forEach((memberId, counts) ->
                    copy.heavyDaysCountByMemberAndConfig.put(memberId, new HashMap<>(counts))
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
            heavyDaysCountByMemberAndConfig.clear();
            other.heavyDaysCountByMemberAndConfig.forEach((memberId, counts) ->
                    heavyDaysCountByMemberAndConfig.put(memberId, new HashMap<>(counts))
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
        FALLBACK,
        SOFT_NEGATIVE,
        HARD_NEGATIVE
    }

    private enum MatchStatus {
        EXACT_INTERVAL_PREFERENCE,
        COVERING_INTERVAL_PREFERENCE,
        FULL_DAY_POSITIVE,
        NO_PREFERENCE,
        PARTIAL_INTERVAL_FALLBACK,
        SOFT_NEGATIVE_FALLBACK,
        HARD_NEGATIVE_FALLBACK
    }


    private record CandidateEvaluation(
            RestaurantMember member,
            MatchStatus matchStatus,
            PreferenceGrade grade,
            int shiftsCount,
            String displayName,
            int fairnessScore,
            boolean eligible,
            boolean minRestViolation,
            CandidateRejectionReason rejectionReason
    ) {
    }

    private record CandidateSelectionResult(
            CandidateEvaluation selected,
            int maxShiftsRejectedCount,
            int minRestRejectedCount,
            int overlapRejectedCount,
            List<RejectionHintPlan> rejectionHints
    ) {
        private static CandidateSelectionResult empty() {
            return new CandidateSelectionResult(null, 0, 0, 0, List.of());
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
            List<RejectionHintPlan> rejectionHints,
            int unfilledCount,
            int negativeAssignmentsCount,
            boolean isComplete
    ) {
    }

    private record DayBuildResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            List<UncoveredSlotPlan> uncoveredSlots,
            List<RejectionHintPlan> rejectionHints,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }

    private record CoverageRuleResult(
            List<AssignmentPlan> assignments,
            List<String> warnings,
            List<UncoveredSlotPlan> uncoveredSlots,
            List<RejectionHintPlan> rejectionHints,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {
    }

    private record PositionBuildResult(PositionPlan positionPlan, List<UncoveredSlotPlan> uncoveredSlots, List<RejectionHintPlan> rejectionHints) {
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
