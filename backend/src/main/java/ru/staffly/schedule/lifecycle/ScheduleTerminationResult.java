package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.lifecycle.*;
public record ScheduleTerminationResult(List<Long> affectedScheduleIds, int cancelledFutureShiftCount,
 int historicalPublishedRowCount, int removedPreferenceSubmissionCount, int removedParticipationCount,
 int invalidatedAppliedPreferenceDraftCount) implements TerminationModuleResult {
 public ScheduleTerminationResult { affectedScheduleIds = List.copyOf(affectedScheduleIds); }
 @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
