package ru.staffly.schedule.service.autobuild;

import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildTemplate;

import java.util.Map;
import java.util.Set;

public interface ScheduleAutoBuildPlanner {
    ScheduleAutoBuildPlan build(Long restaurantId, Schedule schedule, ScheduleBuildTemplate template);

    record ScheduleAutoBuildPlan(
            Long scheduleId,
            Long templateId,
            String templateName,
            Set<Long> affectedPositionIds,
            java.util.List<PositionPlan> positions,
            java.util.List<String> warnings,
            java.util.List<UncoveredSlotPlan> uncoveredSlots,
            java.util.List<RejectionHintPlan> rejectionHints,
            int totalAssignments,
            int warningsCount,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {}

    record PositionPlan(
            Long positionId,
            String positionName,
            java.util.List<Long> positionIds,
            java.util.List<AssignmentPlan> cells,
            java.util.List<String> warnings,
            int totalAssignments,
            int warningsCount,
            int unfilledCount,
            int negativeAssignmentsCount
    ) {}

    record UncoveredSlotPlan(
            String date,
            Long positionId,
            java.util.List<Long> positionIds,
            String positionName,
            String startTime,
            String endTime,
            int requiredCount,
            int assignedCount
    ) {}

    record RejectionHintPlan(
            Long memberId,
            String memberName,
            String date,
            Long positionId,
            String positionName,
            Long shiftOptionId,
            String shiftLabel,
            String startTime,
            String endTime,
            String reason,
            String message
    ) {}

    record AssignmentPlan(
            Long memberId,
            String memberName,
            String day,
            String value,
            Long shiftOptionId,
            String shiftLabel,
            String startTime,
            String endTime,
            String reason,
            String matchStatus,
            String warningMessage,
            java.util.List<String> warnings
    ) {}
}
