# 7G.5.1 Certification assignment cycle foundation

The three independent identities are now explicit:

- test version: `CertificationAssessmentSpecification`;
- global assignment cohort: `CertificationAssignmentCycle`;
- personal reset within a cohort: `TrainingExamAssignment.resetGeneration`.

For example, specification v2 can have cycle 5 with user A generations 0 and 1,
then cycle 6 with user A generation 0. Cycle sequence is monotonic per exam and is
not derived from the specification version.

## Migration and lifecycle boundary

Historical assignments remain `assignment_cycle_id = null`; no global cohort is
inferred from incomplete historical evidence. Their former
`(exam, user, version, reset_generation)` uniqueness is retained by a partial index.
Cycle-linked rows instead use the partial unique identity
`(assignment_cycle, user, reset_generation)`. The existing partial unique active scope
`(exam, restaurant, user) where is_active` remains unchanged.

Cycle allocation is serialized as: acquire the exam `PESSIMISTIC_WRITE` lock, read the
maximum sequence, add one, and insert. The cycle service owns only this identity creation.

Current assignment creation remains intentionally legacy-compatible and creates null-cycle
rows until the next lifecycle step wires a publication cycle into initial/audience and new
material creation, inherits the cycle during per-user reset, and launches an explicit cycle
for global reset/re-certification. Notification behavior likewise remains exam-scoped; the
new cycle notification-state table is storage readiness only.

The exact assignment creation follow-up points are all centralized in
`CertificationAssignmentService`: audience add/re-add uses `syncAudienceAssignments`, a
material publication/global-cycle transition uses `createAssignmentsForNewCycle`, and a
personal reset directly builds its successor in `fullResetEmployeeAttempts`. Initial exam
audience and restore currently converge on audience synchronization; there are no direct SQL
assignment inserts. When lifecycle integration is implemented, the first two paths must be
given the newly launched global cycle, while personal reset must inherit the old assignment's
cycle and set `USER_RESET` plus the exact replacement link. Archive writers must then record
the appropriate deactivation reason without changing attempt resumability.
