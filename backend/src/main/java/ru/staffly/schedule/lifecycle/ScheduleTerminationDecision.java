package ru.staffly.schedule.lifecycle;
import java.util.List;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.ScheduleToken;
import ru.staffly.member.lifecycle.*;
public record ScheduleTerminationDecision(List<ScheduleToken> tokens) implements TerminationModuleDecision {
    public ScheduleTerminationDecision { tokens = List.copyOf(tokens); }
    @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
}
