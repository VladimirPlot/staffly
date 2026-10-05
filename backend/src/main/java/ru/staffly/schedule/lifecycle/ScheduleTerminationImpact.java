package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.ScheduleImpact;
import ru.staffly.member.lifecycle.*;
public record ScheduleTerminationImpact(List<ScheduleImpact> schedules) implements TerminationModuleImpact {
    public ScheduleTerminationImpact { schedules = List.copyOf(schedules); }
    @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
