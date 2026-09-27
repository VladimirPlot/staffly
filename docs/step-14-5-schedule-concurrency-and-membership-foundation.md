# STEP 14.5.1 — Schedule concurrency and membership foundation

## Re-audit and scope

The implementation re-audit confirmed the STEP 14.4 ownership model. Preference submission already resolves participation explicitly, and shift-request mutations already lock the parent Schedule before request children. The remaining ordinary-read mutation gaps were auto-build apply (including adjusted apply), simple preference apply, publish, delete, add-member, and ownership change/reassignment. Manual update and collection start already locked Schedule, but their new-participation snapshots read current member positions after that lock, which did not fit the required future position-change lock order.

No STOP condition was found: no migration is needed, Schedule can remain the aggregate mutex, inbox events are persisted transactionally, and snapshot creation can be stabilized without changing eligibility rules or implementing product situations #1–7.

## Authoritative ownership model

* `RestaurantMember` is current restaurant membership.
* `RestaurantMember.position` is current restaurant position and is consulted only to establish a new participation/candidate.
* `ScheduleParticipation` is explicit membership in an existing Schedule.
* `ScheduleParticipation.positionId` and `positionName` are the immutable, authoritative position snapshot in that Schedule.
* `ScheduleRow` and `ScheduleCell` are materialized/historical content, not membership.
* Preference submissions, Schedule positions, and row existence do not imply participation.

When materializing a row for an existing participant, the participation snapshot supplies its position. Current member position supplies it only while new participation is being established.

## Mutex, version, transaction, and lock order

`Schedule PESSIMISTIC_WRITE` is the mutex for every mutation of an existing Schedule aggregate. Validation and expected-version comparison happen after acquiring that lock. `@Version` remains stale-client protection; it does not replace server-side serialization. A real aggregate mutation updates/touches Schedule and is flushed in the existing transaction, so the version advances. Read-only previews retain fingerprint/recheck behavior and do not force a version increment.

Global database lock order is:

1. `RestaurantMember` rows, ascending member id, when current position will be snapshotted;
2. `Schedule` rows, ascending schedule id;
3. `ScheduleBuildTemplate`, when required;
4. Schedule child rows, ascending id or their existing deterministic repository order.

Collection start uses two-phase discovery: discover candidate ids without locks, lock those members in ascending order, lock Schedule, then revalidate the discovered Schedule-position set, every candidate, and the complete eligible-member set. A mismatch aborts and the command is retried. Add-member and explicit participation addition lock the member before Schedule. Manual create/update locks all requested members in ascending id before persisting/locking Schedule. This means a snapshot is wholly before or after a future position-change transaction that follows the same member-first protocol.

The existing current-position update now locks its `RestaurantMember` row before changing `position`. This is mutex participation only; it does not implement affected-Schedule position-change orchestration.

Multiple Schedules are locked by a restaurant-scoped, `ORDER BY s.id ASC` repository primitive; callers never rely on `IN` result order.

ScheduleBuildTemplate update first reads an optimistic, non-locking template snapshot and performs
fail-fast version and request validation. That early version check is an optimization only; the
snapshot is detached and does not participate in the mutation lock order. The command then discovers
linked Schedule ids without mutation locks, canonicalizes them, locks those Schedules in ascending id
order, and only then locks/reloads the template. The expected template version and the complete
authoritative linked-Schedule set are revalidated after the template lock and before impact planning
or mutation. Request preparation is repeated against that final locked template, and planning and
mutation use only the locked aggregate. A changed discovery set produces
`SCHEDULE_BUILD_TEMPLATE_LINKAGE_CHANGED`; acquisition is not expanded after the template lock and
there is no automatic retry that could make a stale request succeed. This preserves the global
`RestaurantMember` → `Schedule` → `ScheduleBuildTemplate` → children order and leaves a member-lock
phase available for future template membership validation.

## Mutation audit and normalization

| Path | Before | After |
|---|---|---|
| Manual create | new aggregate; ordinary member reads | member locks ascending; create rows/participations from stable snapshots |
| Manual update / published edit | Schedule lock, then ordinary member reads | member locks ascending, Schedule lock, revalidate, mutate |
| Add member | ordinary Schedule then ordinary member | member lock, Schedule lock, version/status/eligibility revalidation, mutate |
| Start collection | Schedule lock then ordinary candidate reads | discovery, member locks ascending, Schedule lock, candidate/position revalidation, template lock, mutate |
| Close collection | Schedule lock | unchanged |
| Preference submission | Schedule lock then submission child lock | unchanged |
| Simple preference apply | ordinary Schedule read | Schedule lock, version/status revalidation, mutate |
| Auto-build / adjusted apply | ordinary Schedule read plus version/token checks | Schedule lock, version/status/token revalidation, mutate |
| Publish | ordinary Schedule read | Schedule lock, version/status revalidation, mutate |
| Delete | ordinary Schedule read | Schedule lock, version revalidation, audit/delete |
| Single owner change | ordinary Schedule read | Schedule lock, version revalidation, mutate |
| Multi-Schedule owner reassignment | ordinary unordered schedules | discover, restaurant-scoped Schedule locks ascending, ownership/version revalidation, mutate |
| Participation add/remove | Schedule lock; add used ordinary member read | add: member lock then Schedule lock; remove: Schedule lock; both mutate under aggregate mutex |
| Shift-request create/approve/reject/cancel | Schedule lock before child mutation | unchanged |
| Auto-build preview and ordinary reads | ordinary read plus fingerprint where applicable | unchanged (read-only) |

Participation creation is consolidated in the explicitly lock-scoped `ScheduleParticipationCreator`: restaurant validation, current-position validation, optional Schedule-position eligibility, uniqueness, and immutable snapshot construction live at one boundary. Callers provide the required locks. Row deletion and participation deletion remain separate.

## Concurrency characterization

| Case | Mutex and order | Winner / loser and stale-client result |
|---|---|---|
| A. Two managers edit | requested Members ascending → Schedule | First Schedule locker commits; second revalidates and stale expected version is rejected. |
| B. Collection close vs submission | Schedule | First locker decides lifecycle; loser sees closed/open state after lock. Submission has no client version; close's stale version is rejected when applicable. |
| C. Collection start vs position change | Members ascending → Schedule → template | First member locker fixes before/after snapshot boundary; loser revalidates current positions. Start also rejects stale Schedule version. |
| D. Add member vs position change | Member → Schedule | First member locker wins; add revalidates position after its lock and also checks Schedule version. |
| E. Auto-build apply vs edit | Schedule → template/children | First Schedule locker wins; loser revalidates version, status and preview fingerprint. |
| F. Auto-build apply vs participation change | Schedule | First wins; apply loser reloads participation set/fingerprint, add/remove loser revalidates aggregate. |
| G. Publish vs edit | Schedule | First wins; loser sees new version/status and stale client version is rejected. |
| H. Publish vs auto-build apply | Schedule | First wins; loser sees incompatible status/version/token and aborts. |
| I. Delete vs mutation | Schedule | First wins; loser observes missing aggregate or stale state and aborts. |
| J. Two participation additions | Member → Schedule | Member lock serializes same-member adds; Schedule serializes all adds; loser finds the unique existing participation. |
| K. New row vs position change | Member(s) ascending → Schedule | First member locker defines snapshot; row uses existing participation snapshot or creates both from the same locked current position. Update's stale Schedule version is also checked. |

## Explicit exclusions

This step does **not** implement employee position-change/removal orchestration, invitation intent, affected-Schedule product decisions, old-participation cleanup, automatic new-position participation, preference reopening/deletion, published-shift cancellation, historical-row UX, template situation #7, or new notification rules.

## Final adversarial re-audit (correction pass)

The correction audit found four concrete weaknesses in the first foundation patch:

1. add-member and manual row materialization still copied current member position directly into a row in parallel with participation creation;
2. an ordinary edit could recreate participation from a retained historical row that no longer had participation;
3. collection start revalidated Schedule positions but did not re-query the complete eligible-member set, so overlapping candidate changes could produce a mixed-time population;
4. preference and shift-request child-only changes did not consistently dirty Schedule, and multi-Schedule reassignment began mutation before validating every expected version.

All four were corrected. `createWithLocksHeld` / `createMissingWithLocksHeld` now make the caller-held-lock precondition explicit. They remain the only production construction boundary.

### Actual lock-order inventory

| Production flow | Locks acquired | Actual order | Result |
|---|---|---|---|
| `EmployeeServiceImpl.updatePosition` | member | Member | Correct; it shares the snapshot mutex and performs no Schedule orchestration. |
| `ScheduleServiceImpl.update` (manual/published) | requested members, Schedule, pending shift requests | Members ascending → Schedule → request children ascending | Correct. |
| `ScheduleServiceImpl.addMember` | member, Schedule | Member → Schedule | Correct. |
| `ScheduleParticipationService.add` | member, Schedule | Member → Schedule | Correct. |
| `ScheduleParticipationService.remove` | Schedule | Schedule | Correct; no current-position snapshot. |
| `ScheduleServiceImpl.startPreferenceCollection` | candidates, Schedule, optional template | Members ascending → Schedule → template | Correct after full candidate-set revalidation. |
| `ScheduleServiceImpl.closePreferenceCollection` | Schedule | Schedule | Correct. |
| `SchedulePreferenceServiceImpl.upsertMyPreference` | Schedule, submission | Schedule → submission | Correct; member lookup is not a member lock and no current position is read. |
| simple preference apply / publish / delete | Schedule | Schedule | Correct. |
| auto-build and adjusted auto-build apply | Schedule | Schedule (template is read-only in apply) | Correct; version and both fingerprint checks occur while Schedule is locked. |
| `ScheduleOwnershipService.changeOwner` | Schedule | Schedule | Correct; owner lookup is not a member lock and no position snapshot is created. |
| `ScheduleOwnershipService.reassignOwnedSchedules` | all Schedules | Schedules ascending | Correct; complete set/candidates/versions are validated before first mutation. |
| shift-request create | Schedule | Schedule | Correct; participation is checked before row content is used. |
| shift-request decide/cancel | Schedule, request | Schedule → request | Correct; initial request lookup only discovers parent Schedule id. |
| Schedule update auto-rejection | Schedule, pending requests | Schedule → request children ascending | Correct. |
| template update | linked Schedules, template | optimistic read/validation → discovery → Schedules ascending → Template | Correct; the read is non-locking and linkage/version are revalidated under the final locks before planning or mutation. |
| template archive | template | Template | Correct; it acquires no Schedule lock. |

There is no production `Schedule PESSIMISTIC_WRITE → RestaurantMember PESSIMISTIC_WRITE` path. Member reads used by access, notification, preference, shift-request, and ownership code are ordinary reads and do not participate in the member lock order.

### Participation and row construction inventory

Production `ScheduleParticipation.builder()` and `participations.save(...)` occur only inside `ScheduleParticipationCreator`. Creation callers are:

* new Schedule creation: requested members are locked ascending; the new Schedule is persisted; participations are created; rows copy the returned participation snapshots;
* manual update: requested members are locked ascending, existing Schedule is locked, validation distinguishes participation from historical row, missing participations are created, then new rows copy participation snapshots;
* add-member: member is locked, Schedule is locked and revalidated, participation is created first, then the row copies it;
* collection start: the fully revalidated candidate set is locked ascending before Schedule/template, then missing participation is created;
* explicit participation add: member then Schedule are locked before creation.

Existing participation is returned unchanged before any current-position validation. A historical row without participation remains historical during ordinary edit and cannot recreate membership; explicit add-member is the re-entry boundary.

The only production `ScheduleRow.builder()` sites are manual new-Schedule rows, add-member, and manual-update materialization. Auto-build creates cells only in existing rows. Existing rows retain their saved position and omitted rows/cells are retained as history.

### Collection-start concurrency A–G

The population linearization point is the post-Schedule-lock candidate re-query. Schedule-position identity, locked eligible member ids, and the current restaurant query must all agree before creation.

* **A — Schedule positions change:** locked positions differ from discovery and the command aborts.
* **B — discovered candidate changes position:** its locked current value is filtered and must agree with the final candidate query, otherwise the command aborts.
* **C — a newly eligible/new member appears:** if visible by final re-query it causes set mismatch and retry; if not yet visible it is concurrent-after the snapshot.
* **D — candidate removed/changed:** member lock serializes deletion/change; final query/set comparison either excludes it consistently or aborts.
* **E — concurrent position change:** the member row mutex places each relevant change before or after the snapshot; final set comparison prevents a mixed population.
* **F — concurrent Schedule update:** Schedule mutex serializes it; position/version revalidation rejects stale collection start.
* **G — second collection start:** member locks and then Schedule mutex serialize both; the loser observes the new status/version and fails lifecycle/version validation.

### Version guarantee

`Schedule.updatedAt` is a mapped scalar. Setting it makes the managed root dirty; Hibernate's transaction commit performs an automatic flush, updates the Schedule row with its `@Version` predicate, and increments `version`. Explicit `saveAndFlush`/`flush` is retained where the operation needs the increment before subsequent audit/notification work. Participation add/remove touch the root only when the child set actually changes. Manual edits, preference submission, and every shift-request state mutation now explicitly touch the locked Schedule, so inverse child collection behavior is not relied upon for root-version advancement.
