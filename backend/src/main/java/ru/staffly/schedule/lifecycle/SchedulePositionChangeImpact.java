package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.dto.PositionChangeImpactPlan.*;
import ru.staffly.member.lifecycle.*;
public record SchedulePositionChangeImpact(List<OldPositionImpact> oldPositionImpacts,
 List<NewPositionOpportunity> newPositionOpportunities) implements PositionChangeModuleImpact {
 public SchedulePositionChangeImpact { oldPositionImpacts=List.copyOf(oldPositionImpacts); newPositionOpportunities=List.copyOf(newPositionOpportunities); }
 @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
