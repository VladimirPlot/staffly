package ru.staffly.schedule.service.impl.autobuild;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Component;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.SchedulePositionIds;
import ru.staffly.schedule.model.ScheduleBuildCoverageDateOverride;
import ru.staffly.schedule.model.ScheduleBuildCoverageRule;
import ru.staffly.schedule.model.CanonicalBusinessInterval;
import ru.staffly.schedule.model.CanonicalBusinessIntervalResolver;
import ru.staffly.schedule.model.ScheduleBuildMinRestMode;
import ru.staffly.schedule.model.ScheduleBuildPositionConfig;
import ru.staffly.schedule.model.ScheduleBuildShiftOption;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleBuildWeekdayRegime;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.AssignmentPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.PositionPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.ScheduleAutoBuildPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.UncoveredSlotPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner.RejectionHintPlan;
import ru.staffly.schedule.service.autobuild.ScheduleAutoBuildPlanner;

import java.time.Duration;
import java.time.LocalDate;
import java.time.LocalDateTime;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.IdentityHashMap;
import java.util.LinkedHashMap;
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

    private final SchedulePreferenceSubmissionRepository submissions;
    private final ScheduleParticipationRepository participations;

    @Override
    public ScheduleAutoBuildPlan build(Long restaurantId, Schedule schedule, ScheduleBuildTemplate template) {
        initializeTemplateCollections(template);

        List<String> topWarnings = new ArrayList<>();
        List<Long> schedulePositions = SchedulePositionIds.ids(schedule);
        List<ScheduleBuildPositionConfig> positionConfigs = safePositionConfigs(template);
        List<EffectivePositionConfig> effectivePositionConfigs = positionConfigs.stream()
                .map(config -> new EffectivePositionConfig(
                        config,
                        intersection(configPositionIds(config), schedulePositions)
                ))
                .toList();
        Set<Long> templatePositionIds = positionConfigs.stream()
                .flatMap(config -> configPositionIds(config).stream())
                .collect(Collectors.toSet());

        for (EffectivePositionConfig effectiveConfig : effectivePositionConfigs) {
            if (effectiveConfig.positionIds().isEmpty()) {
                topWarnings.add("В шаблоне есть блок должностей вне графика: " + configDisplayName(effectiveConfig.config()));
            }
        }

        for (Long schedulePositionId : schedulePositions) {
            if (!templatePositionIds.contains(schedulePositionId)) {
                topWarnings.add("Для одной из позиций графика нет конфигурации в шаблоне (positionId=" + schedulePositionId + ")");
            }
        }

        Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay =
                loadPreferencesByMemberAndDay(schedule.getId());
        List<Long> relevantPositionIds = effectivePositionConfigs.stream()
                .flatMap(effectiveConfig -> effectiveConfig.positionIds().stream())
                .distinct()
                .toList();
        CandidatePopulation candidatePopulation = loadCandidates(schedule.getId(), relevantPositionIds);
        PlannerState plannerState = new PlannerState();
        plannerState.registerParticipationPositions(candidatePopulation.positionByMember());
        List<PositionPlan> positions = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();

        for (EffectivePositionConfig effectiveConfig : effectivePositionConfigs) {
            if (effectiveConfig.positionIds().isEmpty()) {
                continue;
            }
            PositionBuildResult positionResult = buildPosition(
                    schedule,
                    effectiveConfig.config(),
                    effectiveConfig.positionIds(),
                    candidatesForPositions(candidatePopulation, effectiveConfig.positionIds()),
                    preferencesByMemberAndDay,
                    plannerState
            );
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
                deduplicateRejectionHints(rejectionHints),
                totalAssignments,
                warningsCount,
                unfilledCount,
                negativeAssignmentsCount
        );
    }

    private PositionBuildResult buildPosition(
            Schedule schedule,
            ScheduleBuildPositionConfig config,
            List<Long> effectivePositionIds,
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            PlannerState plannerState
    ) {
        for (ScheduleBuildWeekdayRegime regime : config.getWeekdayRegimes()) {
            plannerState.registerCanonicalOptions(CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(
                    regime.getWorkPeriodStart(), regime.getWorkPeriodEnd()), regime.getShiftOptions());
        }
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();

        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;
        double targetShiftsPerCandidate = targetShiftsPerCandidate(schedule, config, candidates);


        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            ScheduleBuildWeekdayRegime regime = config.regimeFor(day.getDayOfWeek());
            CanonicalBusinessInterval workPeriod = CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(
                    regime.getWorkPeriodStart(), regime.getWorkPeriodEnd());
            DemandLookup demandLookup = buildDemandLookup(regime);
            DayBuildResult dayResult = buildAssignmentsForDay(
                    day,
                    config,
                    regime,
                    workPeriod,
                    demandLookup,
                    candidates,
                    preferencesByMemberAndDay,
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

    private CandidatePopulation loadCandidates(Long scheduleId, List<Long> positionIds) {
        if (positionIds.isEmpty()) {
            return new CandidatePopulation(List.of(), Map.of());
        }
        Set<Long> allowed = new HashSet<>(positionIds);
        List<ScheduleParticipation> foundParticipations = participations.findByScheduleIdOrderById(scheduleId).stream()
                .filter(participation -> allowed.contains(participation.getPositionId()))
                .toList();
        List<RestaurantMember> foundMembers = foundParticipations.stream()
                .map(ScheduleParticipation::getMember)
                .filter(member -> member.getUser() != null)
                .toList();
        Set<Long> foundMemberIds = foundMembers.stream().map(RestaurantMember::getId).collect(Collectors.toSet());
        Map<Long, Long> positionByMember = foundParticipations.stream()
                .filter(participation -> foundMemberIds.contains(participation.getMember().getId()))
                .collect(Collectors.toMap(participation -> participation.getMember().getId(),
                        ScheduleParticipation::getPositionId));
        return new CandidatePopulation(foundMembers, positionByMember);
    }

    private List<RestaurantMember> candidatesForPositions(
            CandidatePopulation population,
            List<Long> positionIds
    ) {
        Set<Long> positionIdSet = new HashSet<>(positionIds);
        return population.members().stream()
                .filter(member -> positionIdSet.contains(population.positionByMember().get(member.getId())))
                .toList();
    }

    private DayBuildResult buildAssignmentsForDay(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            ScheduleBuildWeekdayRegime regime,
            CanonicalBusinessInterval workPeriod,
            DemandLookup demandLookup,
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<UncoveredSlotPlan> uncoveredSlots = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();
        int unfilledCount = 0;
        int negativeAssignmentsCount = 0;

        List<ScheduleBuildCoverageRule> coverageRules = effectiveCoverageRulesForDate(regime, day, demandLookup);
        if (!demandLookup.hasWeeklyRules()
                && coverageRules.isEmpty()
                && !demandLookup.overridesByDate().containsKey(day)) {
            return buildLegacyAssignmentsForDay(day, config, regime, candidates, preferencesByMemberAndDay, plannerState);
        }

        for (ScheduleBuildCoverageRule rule : coverageRules) {
            CoverageRuleResult ruleResult = buildAssignmentForCoverageRule(
                    day,
                    config,
                    CanonicalBusinessIntervalResolver.resolveInside(
                            workPeriod, rule.getStartTime(), rule.getEndTime()),
                    rule,
                    candidates,
                    preferencesByMemberAndDay,
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
            CanonicalBusinessInterval canonicalRule,
            ScheduleBuildCoverageRule rule,
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
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
        List<ScheduleBuildShiftOption> shiftOptions = rule.getWeekdayRegime().getShiftOptions();
        ScheduleBuildShiftOption singleOption = findExactShiftOption(shiftOptions, canonicalRule, plannerState);

        for (int index = 0; index < requiredCount; index++) {
            CandidateSelectionResult singleSelection = CandidateSelectionResult.empty();
            if (singleOption != null) {
                singleSelection = pickMember(
                        candidates,
                        preferencesByMemberAndDay,
                        day,
                        singleOption,
                        config,
                        plannerState,
                        targetShiftsPerCandidate
                );
                CandidateEvaluation selectedSingle = singleSelection.selected();
                if (selectedSingle != null && isGoodSingleMatch(selectedSingle.preferenceEvaluation())) {
                    AssignmentBuildResult assignmentResult = assignSelected(
                            assignments,
                            plannerState,
                            selectedSingle,
                            day,
                            singleOption,
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
                    canonicalRule,
                    candidates,
                    preferencesByMemberAndDay,
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
                unfilledCount += positiveSplitResult.unfilledCount();
                negativeAssignmentsCount += positiveSplitResult.negativeAssignmentsCount();
                continue;
            }

            if (singleOption != null && singleSelection.selected() != null) {
                AssignmentBuildResult assignmentResult = assignSelected(
                        assignments,
                        plannerState,
                        singleSelection.selected(),
                        day,
                        singleOption,
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
                    canonicalRule,
                    candidates,
                    preferencesByMemberAndDay,
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
            CanonicalBusinessInterval canonicalRule,
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
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
        int ruleStart = canonicalRule.startMinute();
        int ruleEnd = canonicalRule.endMinute();
        int cursor = ruleStart;

        while (cursor < ruleEnd) {
            SplitOptionSelection splitSelection = selectSplitOption(
                    shiftOptions,
                    canonicalRule,
                    cursor,
                    candidates,
                    preferencesByMemberAndDay,
                    day,
                    config,
                    workingState,
                    allowNegativeAssignments,
                    targetShiftsPerCandidate
            );

            if (splitSelection.option() == null || splitSelection.selection().selected() == null) {
                rejectionHints.addAll(splitSelection.selection().rejectionHints());
                int nextBoundary = nextCoverageBoundary(shiftOptions, cursor, ruleEnd, workingState);
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
            CandidateEvaluation selected = splitSelection.selection().selected();
            AssignmentBuildResult assignmentResult = assignSelected(
                    assignments,
                    workingState,
                    selected,
                    day,
                    option,
                    config
            );
            if (isNegativeGrade(assignmentResult.grade())) {
                negativeAssignmentsCount++;
            }
            cursor = workingState.canonicalInterval(option).endMinute();
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
            CandidateEvaluation selectedEvaluation,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config
    ) {
        RestaurantMember selected = selectedEvaluation.member();
        boolean minRestViolation = !isStrictMinRest(config) && violatesMinRest(selected, config, plannerState, day, option);
        AssignmentBuildResult assignmentResult = createAssignment(
                selected,
                plannerState.participationPosition(selected.getId()),
                day,
                option,
                selectedEvaluation.preferenceEvaluation().status(),
                minRestViolation,
                config.getMinRestHours()
        );
        assignments.add(assignmentResult.assignment());
        registerAssignment(plannerState, selected, day, option, config);
        return assignmentResult;
    }

    private SplitOptionSelection selectSplitOption(
            List<ScheduleBuildShiftOption> shiftOptions,
            CanonicalBusinessInterval canonicalRule,
            int cursor,
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            LocalDate day,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            boolean allowNegativeAssignments,
            double targetShiftsPerCandidate
    ) {
        SplitOptionSelection best = null;
        for (ScheduleBuildShiftOption option : shiftOptions) {
            CanonicalBusinessInterval canonicalOption = plannerState.canonicalInterval(option);
            int optionStart = canonicalOption.startMinute();
            int optionEnd = canonicalOption.endMinute();
            if (optionStart < canonicalRule.startMinute() || optionEnd > canonicalRule.endMinute()) {
                continue;
            }
            if (optionStart > cursor || optionEnd <= cursor) {
                continue;
            }
            CandidateSelectionResult selection = pickMember(
                    candidates,
                    preferencesByMemberAndDay,
                    day,
                    option,
                    config,
                    plannerState,
                    targetShiftsPerCandidate,
                    allowNegativeAssignments
            );
            if (selection.selected() == null) {
                best = best == null ? new SplitOptionSelection(option, selection) : best;
                continue;
            }
            SplitOptionSelection current = new SplitOptionSelection(option, selection);
            if (best == null || compareSplitOption(current, best, cursor, canonicalRule.endMinute(), plannerState) < 0) {
                best = current;
            }
        }
        return best == null ? new SplitOptionSelection(null, CandidateSelectionResult.empty()) : best;
    }

    private int compareSplitOption(
            SplitOptionSelection left,
            SplitOptionSelection right,
            int cursor,
            int ruleEnd,
            PlannerState plannerState
    ) {
        CandidateEvaluation leftCandidate = left.selection().selected();
        CandidateEvaluation rightCandidate = right.selection().selected();
        if (leftCandidate == null && rightCandidate != null) {
            return 1;
        }
        if (leftCandidate != null && rightCandidate == null) {
            return -1;
        }
        int leftStart = plannerState.canonicalInterval(left.option()).startMinute();
        int rightStart = plannerState.canonicalInterval(right.option()).startMinute();
        int byExactStart = Boolean.compare(rightStart == cursor, leftStart == cursor);
        if (byExactStart != 0) {
            return byExactStart;
        }
        int byPreference = comparePreference(leftCandidate.preferenceEvaluation(), rightCandidate.preferenceEvaluation());
        if (byPreference != 0) {
            return byPreference;
        }
        int leftEnd = plannerState.canonicalInterval(left.option()).endMinute();
        int rightEnd = plannerState.canonicalInterval(right.option()).endMinute();
        int leftExtraCoverage = Math.max(0, cursor - leftStart) + Math.max(0, leftEnd - ruleEnd);
        int rightExtraCoverage = Math.max(0, cursor - rightStart) + Math.max(0, rightEnd - ruleEnd);
        int byExtraCoverage = Integer.compare(leftExtraCoverage, rightExtraCoverage);
        if (byExtraCoverage != 0) {
            return byExtraCoverage;
        }
        int byEndFit = Integer.compare(Math.abs(ruleEnd - leftEnd), Math.abs(ruleEnd - rightEnd));
        if (byEndFit != 0) {
            return byEndFit;
        }
        int bySortOrder = Integer.compare(
                Optional.ofNullable(left.option().getSortOrder()).orElse(0),
                Optional.ofNullable(right.option().getSortOrder()).orElse(0)
        );
        if (bySortOrder != 0) {
            return bySortOrder;
        }
        return Comparator.nullsLast(Long::compareTo).compare(left.option().getId(), right.option().getId());
    }


    int comparePreference(PreferenceEvaluation left, PreferenceEvaluation right) {
        int byHardConflict = Long.compare(left.hardConflictMinutes(), right.hardConflictMinutes());
        return byHardConflict != 0
                ? byHardConflict
                : Long.compare(left.softConflictMinutes(), right.softConflictMinutes());
    }

    private boolean isGoodSingleMatch(PreferenceEvaluation preference) {
        return preference.hardConflictMinutes() == 0 && preference.softConflictMinutes() == 0;
    }

    private boolean isNegativeGrade(PreferenceGrade grade) {
        return grade == PreferenceGrade.SOFT_NEGATIVE || grade == PreferenceGrade.HARD_NEGATIVE;
    }

    private int nextCoverageBoundary(
            List<ScheduleBuildShiftOption> shiftOptions,
            int cursor,
            int ruleEnd,
            PlannerState plannerState
    ) {
        return shiftOptions.stream()
                .mapToInt(option -> plannerState.canonicalInterval(option).startMinute())
                .filter(start -> start > cursor && start < ruleEnd)
                .min()
                .orElse(ruleEnd);
    }

    private LocalTime minuteToTime(int minute) {
        int minuteOfDay = Math.floorMod(minute, END_OF_DAY_MINUTES);
        return LocalTime.of(minuteOfDay / 60, minuteOfDay % 60);
    }

    private AssignmentBuildResult createAssignment(
            RestaurantMember member,
            Long participationPositionId,
            LocalDate day,
            ScheduleBuildShiftOption option,
            MatchStatus matchStatus,
            boolean minRestViolation,
            Integer minRestHours
    ) {
        List<String> cellWarnings = new ArrayList<>();
        PreferenceGrade grade = grade(matchStatus);
        String reason = reasonFor(cellWarnings, matchStatus, formatShift(option));
        String warningMessage = warningMessageFor(matchStatus);
        if (minRestViolation) {
            cellWarnings.add("Мало отдыха");
            warningMessage = "Между сменами меньше " + minRestHours + " часов отдыха.";
        }

        AssignmentPlan assignment = new AssignmentPlan(
                member.getId(),
                displayName(member),
                participationPositionId,
                day.toString(),
                formatShift(option),
                option.getId(),
                option.getLabel(),
                option.getStartTime().toString(),
                option.getEndTime().toString(),
                reason,
                previewMatchStatus(matchStatus),
                warningMessage,
                cellWarnings
        );

        return new AssignmentBuildResult(assignment, grade);
    }

    private String previewMatchStatus(MatchStatus matchStatus) {
        // The preview API has no disjoint-availability value yet; retain its existing
        // availability-window fallback presentation while keeping the internal reason distinct.
        return matchStatus == MatchStatus.DISJOINT_AVAILABLE_FALLBACK
                ? MatchStatus.PARTIAL_INTERVAL_FALLBACK.name()
                : matchStatus.name();
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
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        return pickMember(
                candidates,
                preferencesByMemberAndDay,
                day,
                option,
                config,
                plannerState,
                targetShiftsPerCandidate,
                true
        );
    }

    private CandidateSelectionResult pickMember(
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            double targetShiftsPerCandidate,
            boolean allowNegativeAssignments
    ) {
        List<CandidateEvaluation> eligibleCandidates = new ArrayList<>();
        int maxShiftsRejectedCount = 0;
        int minRestRejectedCount = 0;
        int overlapRejectedCount = 0;
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();

        for (RestaurantMember member : candidates) {
            CandidateEvaluation evaluation = evaluateCandidate(
                    member,
                    preferencesByMemberAndDay,
                    day,
                    option,
                    config,
                    plannerState,
                    targetShiftsPerCandidate
            );
            if (!evaluation.eligible()) {
                if (evaluation.rejectionReason() == CandidateRejectionReason.MAX_SHIFTS) {
                    maxShiftsRejectedCount++;
                    toMaxShiftsRejectionHint(evaluation, preferencesByMemberAndDay, day, option, config)
                            .ifPresent(rejectionHints::add);
                } else if (evaluation.rejectionReason() == CandidateRejectionReason.MIN_REST) {
                    minRestRejectedCount++;
                } else if (evaluation.rejectionReason() == CandidateRejectionReason.OVERLAP) {
                    overlapRejectedCount++;
                }
                continue;
            }

            if (allowNegativeAssignments || !isNegativeGrade(evaluation.preferenceEvaluation().grade())) {
                eligibleCandidates.add(evaluation);
            }
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
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            double targetShiftsPerCandidate
    ) {
        int shiftsCount = plannerState.shiftsCount(member.getId());
        String displayName = displayName(member);
        boolean minRestViolation = violatesMinRest(member, config, plannerState, day, option);
        SchedulePreferenceCell preferenceCell = preferenceFor(preferencesByMemberAndDay, member.getId(), day);
        PreferenceEvaluation preferenceEvaluation = preferenceEvaluationFor(
                preferenceCell,
                plannerState.workPeriod(option),
                plannerState.canonicalInterval(option)
        );
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
                    preferenceEvaluation,
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
                preferenceEvaluation,
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
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            LocalDate day,
            ScheduleBuildShiftOption option,
            ScheduleBuildPositionConfig config
    ) {
        SchedulePreferenceCell preferenceCell = preferenceFor(preferencesByMemberAndDay, evaluation.member().getId(), day);
        if (hasNegativePreferenceOnDay(preferenceCell)) {
            return Optional.empty();
        }
        PreferenceGrade grade = evaluation.preferenceEvaluation().grade();
        if (grade != PreferenceGrade.POSITIVE && grade != PreferenceGrade.NONE) {
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

    private boolean hasNegativePreferenceOnDay(SchedulePreferenceCell cell) {
        return cell != null
                && (cell.getType() == SchedulePreferenceType.UNAVAILABLE
                || cell.getType() == SchedulePreferenceType.PREFER_DAY_OFF);
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
        if (overlapsExistingAssignment(member, plannerState, day, option)) {
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
            ScheduleBuildShiftOption option
    ) {
        AssignedInterval candidate = new AssignedInterval(day, plannerState.canonicalInterval(option));

        return plannerState.assignedIntervals(member.getId()).stream()
                .anyMatch(candidate::overlaps);
    }

    private boolean violatesMinRest(
            RestaurantMember member,
            ScheduleBuildPositionConfig config,
            PlannerState plannerState,
            LocalDate day,
            ScheduleBuildShiftOption option
    ) {
        Integer minRestHours = config.getMinRestHours();
        if (minRestHours == null || minRestHours <= 0) {
            return false;
        }
        return !hasEnoughRest(
                plannerState.assignedIntervals(member.getId()),
                new AssignedInterval(day, plannerState.canonicalInterval(option)),
                minRestHours
        );
    }

    static boolean hasEnoughRest(
            List<AssignedInterval> existingAssignments,
            AssignedInterval candidate,
            int minRestHours
    ) {
        Duration requiredRest = Duration.ofHours(minRestHours);

        for (AssignedInterval interval : existingAssignments) {
            if (!candidate.physicalStart().isBefore(interval.physicalEnd())) {
                Duration rest = Duration.between(interval.physicalEnd(), candidate.physicalStart());
                if (rest.compareTo(requiredRest) < 0) {
                    return false;
                }
            } else if (!interval.physicalStart().isBefore(candidate.physicalEnd())) {
                Duration rest = Duration.between(candidate.physicalEnd(), interval.physicalStart());
                if (rest.compareTo(requiredRest) < 0) {
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
        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            List<ScheduleBuildCoverageRule> coverageRules = config.regimeFor(day.getDayOfWeek()).getCoverageRules();
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
                    int byPreference = comparePreference(left.preferenceEvaluation(), right.preferenceEvaluation());
                    if (byPreference != 0) {
                        return byPreference;
                    }

                    // Keep conflict severity as the primary boundary: min-rest and fairness
                    // only break ties between equal hard/soft conflict projections.
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
        plannerState.register(member.getId(), new AssignedInterval(day, plannerState.canonicalInterval(option)));
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

    private String reasonFor(List<String> warnings, MatchStatus matchStatus, String interval) {
        return switch (matchStatus) {
            case EXACT_INTERVAL_PREFERENCE -> "Точное совпадение с пожеланием " + interval + ".";
            case COVERING_INTERVAL_PREFERENCE -> "Пожелание сотрудника покрывает смену " + interval + ".";
            case FULL_DAY_POSITIVE -> "Может работать весь день, выбран по балансу смен.";
            case NO_PREFERENCE -> "Без пожеланий, выбран по балансу смен.";
            case PARTIAL_INTERVAL_FALLBACK -> {
                warnings.add("Назначение частично выходит за пределы пожелания сотрудника");
                yield "Частично вне пожелания сотрудника.";
            }
            case DISJOINT_AVAILABLE_FALLBACK -> {
                warnings.add("Назначение находится вне указанного окна доступности сотрудника");
                yield "Вне указанного окна доступности сотрудника.";
            }
            case SOFT_NEGATIVE_FALLBACK -> {
                warnings.add("Сотрудник предпочитал выходной в это время");
                yield "Поставлен несмотря на пожелание выходного — не хватило сотрудников.";
            }
            case HARD_NEGATIVE_FALLBACK -> {
                warnings.add("Сотрудник указал, что не может работать в это время");
                yield "Поставлен несмотря на недоступность — не хватило сотрудников.";
            }
            default -> "Выбран автоматически.";
        };
    }

    private String warningMessageFor(MatchStatus matchStatus) {
        if (matchStatus == MatchStatus.PARTIAL_INTERVAL_FALLBACK) {
            return "Назначение частично выходит за пределы пожелания сотрудника.";
        }
        if (matchStatus == MatchStatus.DISJOINT_AVAILABLE_FALLBACK) {
            return "Назначение находится вне указанного окна доступности сотрудника.";
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
        if (matchStatus == MatchStatus.DISJOINT_AVAILABLE_FALLBACK) {
            return PreferenceGrade.HARD_NEGATIVE;
        }
        if (matchStatus == MatchStatus.SOFT_NEGATIVE_FALLBACK) {
            return PreferenceGrade.SOFT_NEGATIVE;
        }
        if (matchStatus == MatchStatus.HARD_NEGATIVE_FALLBACK) {
            return PreferenceGrade.HARD_NEGATIVE;
        }
        return PreferenceGrade.NONE;
    }

    private MatchStatus matchStatusFor(
            SchedulePreferenceCell cell,
            ScheduleBuildShiftOption option,
            PlannerState plannerState
    ) {
        return preferenceEvaluationFor(
                cell,
                plannerState.workPeriod(option),
                plannerState.canonicalInterval(option)
        ).status();
    }

    MatchStatus matchStatusFor(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval workPeriod,
            CanonicalBusinessInterval canonicalShift
    ) {
        return preferenceEvaluationFor(cell, workPeriod, canonicalShift).status();
    }

    PreferenceEvaluation preferenceEvaluationFor(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval workPeriod,
            CanonicalBusinessInterval canonicalShift
    ) {
        long assignmentDuration = canonicalShift.endMinute() - canonicalShift.startMinute();
        if (cell == null) {
            return preferenceEvaluation(MatchStatus.NO_PREFERENCE, 0, 0);
        }

        CanonicalBusinessInterval canonicalPreference = canonicalPreference(cell, workPeriod);

        if (isHardNegativeForShift(cell, canonicalPreference, canonicalShift)) {
            return preferenceEvaluation(MatchStatus.HARD_NEGATIVE_FALLBACK, assignmentDuration, 0);
        }

        if (isExactPositiveForShift(cell, canonicalPreference, canonicalShift)) {
            return preferenceEvaluation(MatchStatus.EXACT_INTERVAL_PREFERENCE, 0, 0);
        }

        if (isCoveringPositiveForShift(cell, canonicalPreference, canonicalShift)) {
            return preferenceEvaluation(MatchStatus.COVERING_INTERVAL_PREFERENCE, 0, 0);
        }

        if (isFullDayPositive(cell)) {
            return preferenceEvaluation(MatchStatus.FULL_DAY_POSITIVE, 0, 0);
        }

        if (hasPartialPositiveOverlap(cell, canonicalPreference, canonicalShift)) {
            long overlap = overlapMinutes(canonicalPreference, canonicalShift);
            return preferenceEvaluation(MatchStatus.PARTIAL_INTERVAL_FALLBACK, assignmentDuration - overlap, 0);
        }

        if (isPositiveType(cell.getType()) && canonicalPreference != null) {
            return preferenceEvaluation(MatchStatus.DISJOINT_AVAILABLE_FALLBACK, assignmentDuration, 0);
        }

        if (isSoftNegativeForShift(cell, canonicalPreference, canonicalShift)) {
            return preferenceEvaluation(MatchStatus.SOFT_NEGATIVE_FALLBACK, 0, assignmentDuration);
        }

        return preferenceEvaluation(MatchStatus.NO_PREFERENCE, 0, 0);
    }

    private PreferenceEvaluation preferenceEvaluation(MatchStatus status, long hardConflict, long softConflict) {
        return new PreferenceEvaluation(status, grade(status), hardConflict, softConflict);
    }

    private long overlapMinutes(CanonicalBusinessInterval left, CanonicalBusinessInterval right) {
        return Math.max(0, Math.min(left.endMinute(), right.endMinute())
                - Math.max(left.startMinute(), right.startMinute()));
    }

    private boolean isFullDayPositive(SchedulePreferenceCell cell) {
        return cell.isFullDay() && isPositiveType(cell.getType());
    }

    private CanonicalBusinessInterval canonicalPreference(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval workPeriod
    ) {
        if (cell.isFullDay() || cell.getStartTime() == null || cell.getEndTime() == null) {
            return null;
        }
        try {
            return CanonicalBusinessIntervalResolver.resolveInside(
                    workPeriod, cell.getStartTime(), cell.getEndTime());
        } catch (IllegalArgumentException exception) {
            return null;
        }
    }

    private boolean isExactPositiveForShift(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval canonicalPreference,
            CanonicalBusinessInterval canonicalShift
    ) {
        return isPositiveType(cell.getType())
                && !cell.isFullDay()
                && canonicalPreference != null
                && canonicalPreference.equals(canonicalShift);
    }

    private boolean isCoveringPositiveForShift(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval canonicalPreference,
            CanonicalBusinessInterval canonicalShift
    ) {
        return isPositiveType(cell.getType())
                && !cell.isFullDay()
                && canonicalPreference != null
                && canonicalPreference.contains(canonicalShift)
                && !canonicalPreference.equals(canonicalShift);
    }

    private boolean isSoftNegativeForShift(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval canonicalPreference,
            CanonicalBusinessInterval canonicalShift
    ) {
        return isNegativeForShift(
                cell, canonicalPreference, canonicalShift, SchedulePreferenceType.PREFER_DAY_OFF);
    }

    private boolean isHardNegativeForShift(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval canonicalPreference,
            CanonicalBusinessInterval canonicalShift
    ) {
        return isNegativeForShift(
                cell, canonicalPreference, canonicalShift, SchedulePreferenceType.UNAVAILABLE);
    }

    private boolean isNegativeForShift(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval canonicalPreference,
            CanonicalBusinessInterval canonicalShift,
            SchedulePreferenceType negativeType
    ) {
        if (cell.getType() != negativeType) {
            return false;
        }
        if (cell.isFullDay()) {
            return true;
        }
        return canonicalPreference != null && canonicalPreference.overlaps(canonicalShift);
    }

    private boolean hasPartialPositiveOverlap(
            SchedulePreferenceCell cell,
            CanonicalBusinessInterval canonicalPreference,
            CanonicalBusinessInterval canonicalShift
    ) {
        return !cell.isFullDay()
                && isPositiveType(cell.getType())
                && canonicalPreference != null
                && canonicalPreference.overlaps(canonicalShift)
                && !canonicalPreference.contains(canonicalShift)
                && !canonicalPreference.equals(canonicalShift);
    }

    private boolean isPositiveType(SchedulePreferenceType type) {
        return type == SchedulePreferenceType.AVAILABLE;
    }

    private ScheduleBuildShiftOption findExactShiftOption(
            List<ScheduleBuildShiftOption> options,
            CanonicalBusinessInterval canonicalRule,
            PlannerState plannerState
    ) {
        for (ScheduleBuildShiftOption option : options) {
            if (plannerState.canonicalInterval(option).equals(canonicalRule)) {
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

    private void initializeTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig positionConfig : safePositionConfigs(template)) {
            Hibernate.initialize(positionConfig.getPositions());
            Hibernate.initialize(positionConfig.getWeekdayRegimes());
            for (ScheduleBuildWeekdayRegime regime : positionConfig.getWeekdayRegimes()) {
                Hibernate.initialize(regime.getDaysOfWeek()); Hibernate.initialize(regime.getShiftOptions());
                Hibernate.initialize(regime.getCoverageRules()); Hibernate.initialize(regime.getCoverageDateOverrides());
                regime.getCoverageDateOverrides().forEach(o -> Hibernate.initialize(o.getShiftOption()));
            }
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

    private List<ScheduleBuildPositionConfig> safePositionConfigs(ScheduleBuildTemplate template) {
        if (template.getPositionConfigs() == null) {
            return List.of();
        }
        return template.getPositionConfigs();
    }

    private List<ScheduleBuildShiftOption> safeShiftOptions(ScheduleBuildWeekdayRegime config) {
        if (config.getShiftOptions() == null) {
            return List.of();
        }
        return config.getShiftOptions();
    }

    private DemandLookup buildDemandLookup(ScheduleBuildWeekdayRegime config) {
        Map<LocalDate, List<ScheduleBuildCoverageDateOverride>> overridesByDate = new HashMap<>();
        for (ScheduleBuildCoverageDateOverride dateOverride : safeCoverageDateOverrides(config)) {
            overridesByDate.computeIfAbsent(dateOverride.getDate(), ignored -> new ArrayList<>()).add(dateOverride);
        }

        List<ScheduleBuildCoverageRule> coverageRules = safeCoverageRules(config);
        Map<Integer, List<ScheduleBuildCoverageRule>> weeklyRulesByDayOfWeek = new HashMap<>();
        for (ScheduleBuildCoverageRule rule : coverageRules) {
            weeklyRulesByDayOfWeek.computeIfAbsent(rule.getDayOfWeek(), ignored -> new ArrayList<>()).add(rule);
        }

        return new DemandLookup(overridesByDate, weeklyRulesByDayOfWeek, !coverageRules.isEmpty());
    }

    private List<ScheduleBuildCoverageRule> effectiveCoverageRulesForDate(
            ScheduleBuildWeekdayRegime config,
            LocalDate day,
            DemandLookup demandLookup
    ) {
        if (demandLookup.overridesByDate().containsKey(day)) {
            return demandLookup.overridesByDate().get(day).stream()
                    .filter(override -> override.getShiftOption() != null)
                    .map(override -> ScheduleBuildCoverageRule.builder()
                            .weekdayRegime(config)
                            .dayOfWeek(day.getDayOfWeek().getValue())
                            .startTime(override.getShiftOption().getStartTime())
                            .endTime(override.getShiftOption().getEndTime())
                            .requiredCount(override.getRequiredCount())
                            .sortOrder(0)
                            .build())
                    .toList();
        }
        return demandLookup.weeklyRulesByDayOfWeek().getOrDefault(day.getDayOfWeek().getValue(), List.of());
    }

    private List<ScheduleBuildCoverageDateOverride> safeCoverageDateOverrides(ScheduleBuildWeekdayRegime config) {
        if (config.getCoverageDateOverrides() == null) {
            return List.of();
        }
        return config.getCoverageDateOverrides();
    }

    private List<ScheduleBuildCoverageRule> safeCoverageRules(ScheduleBuildWeekdayRegime config) {
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

    private record DemandLookup(
            Map<LocalDate, List<ScheduleBuildCoverageDateOverride>> overridesByDate,
            Map<Integer, List<ScheduleBuildCoverageRule>> weeklyRulesByDayOfWeek,
            boolean hasWeeklyRules
    ) {
    }

    private DayBuildResult buildLegacyAssignmentsForDay(
            LocalDate day,
            ScheduleBuildPositionConfig config,
            ScheduleBuildWeekdayRegime regime,
            List<RestaurantMember> candidates,
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            PlannerState plannerState
    ) {
        List<AssignmentPlan> assignments = new ArrayList<>();
        List<String> warnings = new ArrayList<>();
        List<RejectionHintPlan> rejectionHints = new ArrayList<>();
        int negativeAssignmentsCount = 0;

        for (ScheduleBuildShiftOption option : safeShiftOptions(regime)) {
            CandidateSelectionResult selection = pickMember(candidates, preferencesByMemberAndDay, day, option, config, plannerState, 0);
            if (selection.selected() == null) {
                rejectionHints.addAll(selection.rejectionHints());
                continue;
            }

            CandidateEvaluation selectedEvaluation = selection.selected();
            RestaurantMember selected = selectedEvaluation.member();
            AssignmentBuildResult assignmentResult = createAssignment(
                    selected, plannerState.participationPosition(selected.getId()), day, option,
                    selectedEvaluation.preferenceEvaluation().status(), false, null);
            assignments.add(assignmentResult.assignment());
            if (isNegativeGrade(assignmentResult.grade())) {
                negativeAssignmentsCount++;
            }
            registerAssignment(plannerState, selected, day, option, config);
        }

        return new DayBuildResult(assignments, warnings, List.of(), rejectionHints, 0, negativeAssignmentsCount);
    }

    private List<RejectionHintPlan> deduplicateRejectionHints(List<RejectionHintPlan> rejectionHints) {
        Map<RejectionHintKey, RejectionHintPlan> distinctHints = new LinkedHashMap<>();
        for (RejectionHintPlan hint : rejectionHints) {
            RejectionHintKey key = new RejectionHintKey(
                    hint.memberId(),
                    hint.date(),
                    hint.positionConfigId(),
                    hint.startTime(),
                    hint.endTime(),
                    hint.reason()
            );
            distinctHints.putIfAbsent(key, hint);
        }
        return List.copyOf(distinctHints.values());
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

    private Map<Long, Map<LocalDate, SchedulePreferenceCell>> loadPreferencesByMemberAndDay(Long scheduleId) {
        Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay = new HashMap<>();
        submissions.findWithCellsByScheduleId(scheduleId).stream()
                .filter(submission -> submission.getMember() != null)
                .forEach(submission -> {
                    Long memberId = submission.getMember().getId();
                    Map<LocalDate, SchedulePreferenceCell> preferencesByDay =
                            preferencesByMemberAndDay.computeIfAbsent(memberId, ignored -> new HashMap<>());
                    if (submission.getCells() == null) {
                        return;
                    }
                    for (SchedulePreferenceCell cell : submission.getCells()) {
                        if (cell == null) {
                            continue;
                        }
                        SchedulePreferenceCell previous = preferencesByDay.putIfAbsent(cell.getDay(), cell);
                        if (previous != null) {
                            throw new IllegalStateException(
                                    "Duplicate schedule preference cell for member " + memberId + " and day " + cell.getDay()
                            );
                        }
                    }
                });
        return preferencesByMemberAndDay;
    }

    private SchedulePreferenceCell preferenceFor(
            Map<Long, Map<LocalDate, SchedulePreferenceCell>> preferencesByMemberAndDay,
            Long memberId,
            LocalDate day
    ) {
        Map<LocalDate, SchedulePreferenceCell> preferencesByDay = preferencesByMemberAndDay.get(memberId);
        return preferencesByDay == null ? null : preferencesByDay.get(day);
    }


    private static final class PlannerState {
        private final Map<Long, Long> participationPositionByMember = new HashMap<>();
        private final Map<Long, Integer> shiftsCountByMember = new HashMap<>();
        private final Map<Long, List<AssignedInterval>> assignedIntervalsByMember = new HashMap<>();
        private final Map<Long, Map<String, Integer>> heavyDaysCountByMemberAndConfig = new HashMap<>();
        private final Map<ScheduleBuildShiftOption, CanonicalBusinessInterval> canonicalIntervalsByOption = new IdentityHashMap<>();
        private final Map<ScheduleBuildShiftOption, CanonicalBusinessInterval> workPeriodsByOption = new IdentityHashMap<>();

        private void registerParticipationPositions(Map<Long, Long> positions) {
            participationPositionByMember.putAll(positions);
        }

        private Long participationPosition(Long memberId) {
            return participationPositionByMember.get(memberId);
        }

        private void registerCanonicalOptions(
                CanonicalBusinessInterval workPeriod,
                List<ScheduleBuildShiftOption> shiftOptions
        ) {
            shiftOptions.forEach(option -> {
                canonicalIntervalsByOption.put(
                        option,
                        CanonicalBusinessIntervalResolver.resolveInside(
                                workPeriod, option.getStartTime(), option.getEndTime())
                );
                workPeriodsByOption.put(option, workPeriod);
            });
        }

        private CanonicalBusinessInterval canonicalInterval(ScheduleBuildShiftOption option) {
            CanonicalBusinessInterval interval = canonicalIntervalsByOption.get(option);
            if (interval == null) {
                throw new IllegalStateException("Shift option has no canonical planner interval");
            }
            return interval;
        }

        private CanonicalBusinessInterval workPeriod(ScheduleBuildShiftOption option) {
            CanonicalBusinessInterval workPeriod = workPeriodsByOption.get(option);
            if (workPeriod == null) {
                throw new IllegalStateException("Shift option has no canonical planner work period");
            }
            return workPeriod;
        }

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
            copy.participationPositionByMember.putAll(participationPositionByMember);
            copy.shiftsCountByMember.putAll(shiftsCountByMember);
            copy.canonicalIntervalsByOption.putAll(canonicalIntervalsByOption);
            copy.workPeriodsByOption.putAll(workPeriodsByOption);
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

    private record CandidatePopulation(List<RestaurantMember> members, Map<Long, Long> positionByMember) {
    }

    static final class AssignedInterval {
        private final LocalDate day;
        private final LocalDateTime physicalStart;
        private final LocalDateTime physicalEnd;

        AssignedInterval(LocalDate day, CanonicalBusinessInterval interval) {
            this.day = day;
            this.physicalStart = interval.physicalStart(day);
            this.physicalEnd = interval.physicalEnd(day);
        }

        LocalDate day() {
            return day;
        }

        LocalDateTime physicalStart() {
            return physicalStart;
        }

        LocalDateTime physicalEnd() {
            return physicalEnd;
        }

        boolean overlaps(AssignedInterval other) {
            return physicalStart.isBefore(other.physicalEnd)
                    && other.physicalStart.isBefore(physicalEnd);
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

    enum MatchStatus {
        EXACT_INTERVAL_PREFERENCE,
        COVERING_INTERVAL_PREFERENCE,
        FULL_DAY_POSITIVE,
        NO_PREFERENCE,
        PARTIAL_INTERVAL_FALLBACK,
        DISJOINT_AVAILABLE_FALLBACK,
        SOFT_NEGATIVE_FALLBACK,
        HARD_NEGATIVE_FALLBACK
    }


    record PreferenceEvaluation(
            MatchStatus status,
            PreferenceGrade grade,
            long hardConflictMinutes,
            long softConflictMinutes
    ) {
    }

    private record CandidateEvaluation(
            RestaurantMember member,
            PreferenceEvaluation preferenceEvaluation,
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

    private record RejectionHintKey(
            Long memberId,
            String date,
            Long positionConfigId,
            String startTime,
            String endTime,
            String reason
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

    private record EffectivePositionConfig(
            ScheduleBuildPositionConfig config,
            List<Long> positionIds
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
