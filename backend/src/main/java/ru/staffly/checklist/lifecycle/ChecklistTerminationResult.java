package ru.staffly.checklist.lifecycle;

import ru.staffly.member.lifecycle.TerminationModuleResult;

public record ChecklistTerminationResult(int releasedReservations) implements TerminationModuleResult { }
