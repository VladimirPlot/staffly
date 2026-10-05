# Phase 1 soft-termination dependency audit

This is the bounded follow-up audit for replacing `RestaurantMember` deletion with an ended period.

## Transitional cleanup implemented now

- **Checklist reservations:** current `ChecklistItem` locks owned by the terminated membership are released in the removal transaction. Completion fields and checklist history are not changed.
- **Published schedule rows:** the existing removal flow marks the row historical and keeps its non-null period `member_id`; the membership is no longer deleted, so the FK remains stable.

## Intentionally deferred to lifecycle handlers

- **Schedule build marker members:** ended memberships remain historical references. Removing them from current build input belongs to the Schedule lifecycle handler; Phase 1 does not change auto-build behavior.
- **Reminder personal targets:** delivery resolves active membership, while stored targets are retained for audit/history. Recipient lifecycle policy is deferred.
- **Inbox recipients and anonymous-letter recipients:** period references are intentionally retained; ended users lose restaurant access through active-membership authorization.
- **Schedule ownership and shift requests:** runtime actor/member resolution now requires active membership. Ownership/handoff and terminal request-state policy are deferred.
- **Tasks and responsibilities:** correct reassignment/handoff and atomicity are Phase 3 lifecycle work, not termination-foundation cleanup.

No auto-build matching, fairness, scoring, factors, or ScheduleParticipation-to-ScheduleRow identity rules are changed here.
