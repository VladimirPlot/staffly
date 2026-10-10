package ru.staffly.reminder.lifecycle;
import ru.staffly.member.lifecycle.*;
public record ReminderTerminationImpact(int personalTargets) implements TerminationModuleImpact {
    @Override public LifecycleModule module() { return LifecycleModule.REMINDER; }
}
