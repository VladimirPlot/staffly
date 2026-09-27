# STEP 14.4 — Schedule participation foundation

## Recheck and stop decision

The recheck confirmed the audit: `Schedule` had positions and rows but no persisted participant relation;
preference access/progress and auto-build loaded members by current position; staff access did the same;
rows and preference submissions were the only persisted per-member schedule facts. Invitation acceptance and
member position/removal contained no schedule-participation orchestration. `Schedule.version` is an optimistic
aggregate version.

No stop condition applies. Existing data cannot be safely inferred: a row can be historical, while absence of a
preference submission does not distinguish a non-responder from a non-participant. Because this is alpha and V90
already established destructive schedule-domain migration precedent, V101 deliberately deletes all schedules and
then introduces the authoritative table. This avoids a heuristic backfill for every status (`DRAFT`,
`COLLECTING_PREFERENCES`, `PREFERENCES_CLOSED`, `DRAFT_FROM_PREFERENCES`, and `PUBLISHED`).

## Model and database semantics

`ScheduleParticipation` contains an identity, required schedule/member relationships, and immutable scalar
`positionId`/`positionName` snapshots. Existence means active participation; there is no status or invitation
relationship. The snapshot is necessary so STEP 14.6 can compare the position under which participation was
created after `RestaurantMember.position` changes, without treating the mutable current position as history.
It intentionally has no Position FK so deleting or renaming dictionary data cannot erase or rewrite the snapshot.

The database enforces `UNIQUE(schedule_id, member_id)`. Both FKs use `ON DELETE CASCADE`: deleting a schedule
removes its aggregate children, and deleting a member removes active participation while independent historical
`ScheduleRow` snapshots can remain. The unique constraint supplies the schedule lookup index; the additional
member index supports future affected-schedule discovery.

Rows were not reused because they represent table content/history and can outlive active participation.
Submissions were not reused because a participant may not respond and submissions represent an answer, not
membership in the collection population.

## Initialization and consumers

* Manual create (draft or published): only members represented by supplied rows become participants; no rows means
  no participants.
* Manual row addition, including rows added through update: adds missing participation. Removing a row does not
  remove participation.
* Starting either DAY_LEVEL or SHIFT_OPTIONS collection snapshots all current restaurant members whose current
  positions are in the schedule. DAY_LEVEL remains template-free; SHIFT_OPTIONS retains template validation and
  exact option snapshots.
* Auto-build apply consumes the already-established participant population; it does not create participation.
* Invitation acceptance creates no participation. A future invitation intent belongs to a separate mechanism.

Preference discovery/access, read/write, progress numerator and denominator, all-submitted notification, and
collection-open recipients now use the same explicit population. Staff list/detail visibility uses participation.
Planner candidates and its fingerprint use participants intersected with current template-compatible positions.
Current position remains compatibility vocabulary; changing it does not silently create participation. Cleanup of
a now-incompatible existing participation is deliberately deferred to STEP 14.6.

Published notification recipient calculation intentionally remains row plus current-position based because it is
a content-change recipient concept. Addable-member discovery remains schedule-position eligibility because it is a
candidate picker, not participation. Schedule position/template validation, row serialization, and manager views
retain their own concepts. The unused position-based schedule repository query remains for compatibility and may
be removed after later orchestration work.

## Concurrency boundary

Collection start, manual updates/add-row, and public participation mutations lock `Schedule`; their schedule
mutation advances `@Version`. The database unique constraint is the final duplicate-race guard. Deletion of a
member relies on FK cascade. V101 itself is migration-time only. No member lock or cross-schedule orchestration is
introduced; deterministic affected-schedule discovery and global Schedule/Member lock ordering remain STEP 14.5.

## Characterization matrix

| Case | Foundation result |
|---|---|
| A | Manual WAITER schedule with no rows has no participants. |
| B | Its explicit WAITER row initializes one participant. |
| C | DAY_LEVEL start snapshots matching members without a template. |
| D | SHIFT_OPTIONS start snapshots matching members after template/snapshot validation. |
| E | One participation row can represent one of two matching WAITERs. |
| F | Participation exists independently with no submission. |
| G | A submission does not add a second participation; uniqueness remains. |
| H | Removing participation does not remove a row. |
| I | A matching non-participant is excluded from planner candidacy. |
| J | A matching non-participant is excluded from preference progress. |
| K | A participant whose current position is outside a template block is excluded from that block. |
| L | Application idempotence and the DB unique constraint prevent duplicates. |
| M | Schedule deletion cascades participation deletion. |
| N | Member deletion cascades active participation deletion. |
| O | DAY_LEVEL has no Build Template dependency. |
| P | SHIFT_OPTIONS option snapshot behavior is unchanged. |

## STEP 14.4.1 snapshot-semantics correction

Participation consumers are classified as follows:

* Planner, fingerprint, adjusted-apply validation, and affected-cell clearing need the **participation position** and
  use `ScheduleParticipation.positionId`.
* Preference eligibility and STAFF visibility need only participation existence.
* Preference progress, collection notifications, and the participation service need member/user identity; preference
  position DTOs and SHIFT_OPTIONS vocabulary use the participation snapshot.
* Participation creation, addable-member discovery, manual row creation, and collection-start population selection
  intentionally use the member's **current** position because they are deciding and snapshotting a new participation
  or showing current candidates. Ownership display intentionally describes current membership rather than
  reclassifying participation.

The final semantic recheck found that published row-recipient calculation was incorrectly classified as current
membership semantics. `notifySchedulePublished` decides who belongs to an existing Schedule, so it now intersects
persisted active rows with explicit Schedule participants and uses current member/user data only for recipient
identity and delivery. A change to `RestaurantMember.position` alone no longer suppresses that notification or
reinterprets the member's place in the Schedule.

The Java entity exposes no setters, so an existing position snapshot cannot be rewritten through a normal mutation
API. New records still copy the current member position through their builder at creation. A temporary mismatch
between current member position and participation position remains valid and is not reconciled here.

Characterization for this correction:

| Case | Result |
|---|---|
| A | WAITER participation plus current WAITER is planned as WAITER. |
| B | WAITER participation plus current BARTENDER is still planned as WAITER. |
| C | The mismatched candidate is fingerprinted with WAITER. |
| D | Changing only current position does not change candidate participation position. |
| E | Apply's member-position map is built from participation snapshots. |
| F | A matching current-position member without participation remains excluded. |
| G | A newly created participation snapshots the member's then-current position. |
| H | Snapshot fields have getters but no public setters. |
| I | DAY_LEVEL remains template-free. |
| J | SHIFT_OPTIONS validation and exact option snapshots are unchanged. |
| K | Preference eligibility remains based on participation existence. |
| L | No position-change cleanup or orchestration is introduced. |

Participation remains part of Schedule aggregate concurrency semantics. Mutations continue to lock/mutate Schedule;
deterministic affected-Schedule discovery and global lock ordering remain unresolved for STEP 14.5.

### Final existing-Schedule current-position audit

The remaining `RestaurantMember.position` reads that touch an existing Schedule are:

* `ScheduleParticipationService.add` and `ScheduleServiceImpl.addMember` validate and snapshot a **new** participation/
  row; current position is intentional at that creation boundary.
* `ScheduleServiceImpl.getAddableMembers`, `findEligibleMembers`, and collection-start initialization select current
  candidates from which a future/new participation may be created; current position is intentional.
* `ScheduleServiceImpl.validateAndMapMembers` uses current eligibility only for the pre-existing stale-row retention
  safeguard. That legacy row-edit rule does not change, remove, or reclassify `ScheduleParticipation`; replacing it
  belongs with the later stale-employee/position-change orchestration rather than this recipient correction.
* New `ScheduleRow` snapshots use current position only when materializing a row that did not exist. Row snapshot
  semantics remain independent from participation and are not used to classify an existing participation.
* Schedule owner DTO construction displays the owner's current restaurant membership position and does not describe
  the owner's participation position.

`notifySchedulePublished` was the sole wrong classification found in this focused recheck: its position query was
being used to decide belonging inside an existing Schedule, not merely current membership state.
