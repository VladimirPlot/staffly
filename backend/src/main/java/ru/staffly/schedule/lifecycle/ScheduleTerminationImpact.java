package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.ScheduleImpact;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.OwnershipResource;
import ru.staffly.member.lifecycle.*;
public record ScheduleTerminationImpact(List<ScheduleImpact> schedules,
                                        List<OwnershipResource> ownership) implements TerminationModuleImpact {
    public ScheduleTerminationImpact { schedules = List.copyOf(schedules); ownership = List.copyOf(ownership); }
    @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
