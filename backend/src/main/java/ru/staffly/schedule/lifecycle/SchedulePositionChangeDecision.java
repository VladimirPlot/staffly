package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.dto.ApplyPositionChangeRequest.ScheduleDecision;
import ru.staffly.member.lifecycle.*;
public record SchedulePositionChangeDecision(List<ScheduleDecision> decisions) implements PositionChangeModuleDecision {
 public SchedulePositionChangeDecision { decisions = List.copyOf(decisions); }
 @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
