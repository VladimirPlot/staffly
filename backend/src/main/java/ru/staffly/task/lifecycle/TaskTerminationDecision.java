package ru.staffly.task.lifecycle;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.TaskDecisions;
import ru.staffly.member.lifecycle.*;
public record TaskTerminationDecision(TaskDecisions decisions) implements TerminationModuleDecision {
    @Override public LifecycleModule module() { return LifecycleModule.TASK; }
}
