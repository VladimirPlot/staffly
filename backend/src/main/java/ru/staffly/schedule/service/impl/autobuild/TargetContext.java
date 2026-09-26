package ru.staffly.schedule.service.impl.autobuild;

/** Exact, immutable assignment-unit target shared by planner ranking paths. */
record TargetContext(long demandUnits, int participantCount, boolean present) {
    static TargetContext of(long demandUnits, int participantCount) {
        return new TargetContext(Math.max(0, demandUnits), Math.max(0, participantCount), true);
    }

    static TargetContext none() {
        return new TargetContext(0, 0, false);
    }

    long scaledOvershoot(int resultingShiftCount) {
        if (!present || participantCount == 0) return 0;
        return Math.max(0L, (long) resultingShiftCount * participantCount - demandUnits);
    }
}
