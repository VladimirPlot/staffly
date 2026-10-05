package ru.staffly.reminder.lifecycle;

import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;

/** Personal membership targets survive; position audience is resolved dynamically. */
@Component
public class ReminderPositionChangeLifecycleHandler implements PositionChangeLifecycleHandler {
    @Override public LifecycleModule module() { return LifecycleModule.REMINDER; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 500; }
    @Override public Impact preview(PositionChangePreviewContext c) { return new Impact(true); }
    @Override public Result applyAfterPositionChange(PositionChangeApplyContext c, PositionChangeModuleDecision d, PositionChangeModulePreparation p) { return new Result(true); }
    public record Impact(boolean personalTargetsPreserved) implements PositionChangeModuleImpact {
        public LifecycleModule module() { return LifecycleModule.REMINDER; }
    }
    public record Result(boolean personalTargetsPreserved) implements PositionChangeModuleResult {
        public LifecycleModule module() { return LifecycleModule.REMINDER; }
    }
}
