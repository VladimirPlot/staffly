package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.dto.*;
import ru.staffly.member.lifecycle.*;
public record SchedulePositionChangeResult(List<Long> affectedScheduleIds,
 List<ApplyPositionChangeResult.ReopenedCollection> reopenedCollections, int cancelledFutureShiftCount,
 List<String> cleanup, List<AppliedPositionChangeScheduleEffect> effects,
 List<ApplyPositionChangeRequest.ScheduleDecision> decisions) implements PositionChangeModuleResult {
 @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
