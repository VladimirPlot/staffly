package ru.staffly.task.lifecycle;
import java.util.List;
import ru.staffly.member.lifecycle.*;
public record TaskTerminationResult(int reassignedAssignees, int orphanedAssignees,
                                    int reassignedSetters, List<Transfer> assigneeTransfers,
                                    List<Transfer> setterTransfers, List<Orphan> orphans) implements TerminationModuleResult {
    public record Transfer(Long taskId, String title, Long memberId) { }
    public record Orphan(Long taskId, String title, Long setterMemberId) { }
    @Override public LifecycleModule module() { return LifecycleModule.TASK; }
}
