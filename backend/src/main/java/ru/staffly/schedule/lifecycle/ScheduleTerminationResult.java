package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.schedule.dto.AppliedScheduleOwnershipTransfer;
import ru.staffly.member.lifecycle.*;
public record ScheduleTerminationResult(List<Long> affectedScheduleIds, int cancelledFutureShiftCount,
 int historicalPublishedRowCount, int removedPreferenceSubmissionCount, int removedParticipationCount,
 int staleAutoBuildScheduleCount, List<AppliedScheduleOwnershipTransfer> ownershipTransfers) implements TerminationModuleResult {
 public int ownersTransferred() { return ownershipTransfers.size(); }
 public ScheduleTerminationResult { affectedScheduleIds = List.copyOf(affectedScheduleIds); ownershipTransfers = List.copyOf(ownershipTransfers); }
 @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
