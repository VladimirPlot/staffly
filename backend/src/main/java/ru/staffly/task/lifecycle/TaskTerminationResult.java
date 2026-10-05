package ru.staffly.task.lifecycle;
import ru.staffly.member.lifecycle.*;
public record TaskTerminationResult(int reassignedAssignees, int orphanedAssignees,
                                    int reassignedSetters) implements TerminationModuleResult {
    @Override public LifecycleModule module() { return LifecycleModule.TASK; }
}
