package ru.staffly.checklist.lifecycle;

import ru.staffly.member.lifecycle.LifecycleModule;
import ru.staffly.member.lifecycle.TerminationModuleImpact;

public record ChecklistTerminationImpact(int activeReservations) implements TerminationModuleImpact {
    @Override public LifecycleModule module() { return LifecycleModule.CHECKLIST; }
}
