package ru.staffly.task.lifecycle;

import java.util.List;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.TaskResponsibility;
import ru.staffly.member.lifecycle.*;

public record TaskTerminationImpact(List<TaskResponsibility> assignees,
                                    List<TaskResponsibility> setters) implements TerminationModuleImpact {
    @Override public LifecycleModule module() { return LifecycleModule.TASK; }
}
