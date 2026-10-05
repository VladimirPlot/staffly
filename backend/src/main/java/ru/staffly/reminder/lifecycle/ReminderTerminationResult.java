package ru.staffly.reminder.lifecycle;
import ru.staffly.member.lifecycle.LifecycleModule;
import ru.staffly.member.lifecycle.TerminationModuleResult;
public record ReminderTerminationResult(int detachedPersonalTargets) implements TerminationModuleResult {
    @Override public LifecycleModule module() { return LifecycleModule.REMINDER; }
}
