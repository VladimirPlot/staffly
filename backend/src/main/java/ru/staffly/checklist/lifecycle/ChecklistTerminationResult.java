package ru.staffly.checklist.lifecycle;

import ru.staffly.member.lifecycle.LifecycleModule;
import ru.staffly.member.lifecycle.TerminationModuleResult;

public record ChecklistTerminationResult(int releasedReservations) implements TerminationModuleResult {
    @Override public LifecycleModule module() { return LifecycleModule.CHECKLIST; }
}
