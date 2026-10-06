# Employee Lifecycle — final architecture audit

## Executive verdict

**READY_FOR_MANUAL_VALIDATION** — 2026-10-06. The confirmed dispatch/reservation/cascade
defects, hidden Certification ownership/activation gap and cross-scope lifecycle
handoff authority coupling are corrected. Hidden
Certification is a restorable business resource with mandatory ownership, independently
of active audience. This report does not claim that manual E2E or PostgreSQL concurrency
scenarios were executed.

Original audited revision: `5e931da52f00ebccdbfc60d29bb12f5686017c16`. Follow-up base:
`6573a634bcfea99371c833bf5e9bd03b00a49322` for hidden ownership, then
`73947071fab2c99448efd73f64f560350d7fd260` for cross-scope authority, plus this
working tree. Branch: `feature/employee-lifecycle-final-audit`; both follow-ups started clean.
The original dev base was confirmed with read-only ls-remote during the initial audit.
No new branch, commit, push, reset, merge or rebase was performed by this follow-up.

## Original target architecture

Phase 0–6 separates User identity from a RestaurantMember employment period.
Admission creates a new period; Position Change keeps its ID and performs old-position
exit → position mutation → new-position entry; Termination ends the period. Each
coordinator owns the transaction, authority, stale-plan checks and notifications.
Ordered module adapters own Schedule, Task, Checklist, Reminder and Certification
rules. Ordinary explicit resource CRUD remains legitimate.

## Authoritative entrypoints

Paths below are relative to `backend/src/main/java/ru/staffly/` unless specified.

| Transition | Production entrypoints | Coordinator | Other mutation paths | Verdict |
|---|---|---|---|---|
| Admission | `POST /api/invitations/{token}/accept` → InvitationAcceptanceController → EmployeeServiceImpl.acceptInvite | AdmissionCoordinator.acceptInvite | None found | One authoritative create path |
| Position Change | `POST /api/restaurants/{restaurantId}/members/{memberId}/position-change` → EmployeeController → PositionChangeApplyService.apply | PositionChangeCoordinator.apply | None found | One authoritative position mutation |
| Termination | `POST /api/restaurants/{restaurantId}/members/{memberId}/remove` → EmployeeController → EmployeeRemovalApplyService.apply; same route handles self leave | TerminateMembershipCoordinator.apply | Restaurant DELETE formerly allowed DB-cascade destruction; fixed | One authoritative end path |
| Invitation plan/save/cancel/decline/expire | EmployeeController invitation impact/invite/cancel; InvitationAcceptanceController decline; InvitationExpiryService | No employment transition until acceptance | Only invitation/intents/status changes | No membership/Schedule/Certification creation on invite save |
| Position definition CRUD | DictionaryController → DictionaryServiceImpl | Ordinary dictionary CRUD | Occupied-position level/specialization changes rejected | Does not bypass per-member Position Change |
| Restaurant create/delete | RestaurantController → RestaurantServiceImpl | Ordinary container CRUD | Create only makes restaurant/base Positions; delete now locks lifecycle row and rejects any employment history | No synthetic membership or cascade bypass |

### Employment mutation inventory and required static searches

Executed `rg -n` over **all** `backend/src/main/java` and `frontend/staffly-frontend/src`
for the requested symbols, plus new constructors, ended setters/builders, deletes,
role setters, reactivation and ownership writes. Tests and migrations were inspected
separately and are not counted as runtime callers.

| Mutation / search | All production call sites | Expected authority | Result |
|---|---|---|---|
| `RestaurantMember.builder` | `member/lifecycle/AdmissionCoordinator.java:109` | AdmissionCoordinator | 1 match |
| `member.end(` | `member/lifecycle/TerminateMembershipCoordinator.java:102` | TerminateMembershipCoordinator | 1 match |
| `setEndedAt(` | None | No direct setter/reactivation path | 0 matches |
| `setPosition(` | `member/lifecycle/PositionChangeCoordinator.java:107` | PositionChangeCoordinator | 1 match |
| Membership delete / reactivate / new constructor | No direct runtime mutation found | No destruction/reactivation of employment periods | Container cascade bypass fixed below |
| `responsibility-handoff` | None | Removed Phase 6 endpoint | 0 matches |
| `assign-admin`, `assignAdmin` | None | Removed direct authority path | 0 matches each |
| `UpdateMemberPositionRequest`, `MemberResponsibilityHandoff` | None | Removed legacy request/service | 0 matches each |
| Persisted member role / `setRole` | No member role column or setter in runtime model | Position.level | Frontend `setRoleLoading` is UI state, not authority |

RestaurantMember exposes Lombok setters, but no production caller uses endedAt to
reactivate a period. V115 retains the unique active User+Restaurant partial index.
Admission checks active membership under the restaurant mutex and creates a new ID.
Repeated accepted-invitation calls return the original acceptedMember; they do not
create another period or replay module effects.

## Module matrix

| Module | Termination | Position Change | Admission | Domain primitive owner | Legacy duplicate? |
|---|---|---|---|---|---|
| Schedule | ScheduleEmployeeLifecycleHandler → ScheduleTerminationApplyHandler: participant/submission exit, row cleanup/history, owner transfer | Same adapter → SchedulePositionChangeApplyHandler: exit before mutation, decision-based entry after | ScheduleAdmissionLifecycleHandler prepares locked intents, applies only after new member exists | SchedulePreferenceLifecycleService, ScheduleOwnershipService, PublishedShiftImpactClassifier | No second automatic reaction found |
| Task | TaskTerminationLifecycleHandler: forced transfer; self-leave orphan; setter handoff | TaskPositionChangeLifecycleHandler: retain individual assignee; handoff setter if capability lost | No adapter needed; no old individual state restored | Task handlers / TaskService | No second automatic reaction found |
| Checklist | ChecklistTerminationLifecycleHandler releases live reservations only | ChecklistPositionChangeLifecycleHandler releases only reservations losing access | No adapter needed; reservations created explicitly | Checklist module | No duplicate; concurrency defect fixed |
| Reminder | ReminderTerminationLifecycleHandler detaches/stops personal target | ReminderPositionChangeLifecycleHandler explicitly preserves personal member targets | No adapter needed; targets created explicitly | ReminderRepository / ReminderServiceImpl / dispatch worker | No duplicate; dispatch resurrection race fixed |
| Certification | CertificationEmployeeLifecycleHandler: active and hidden owner handoff, then active-only audience sync after end | Same adapter: capability-aware active and hidden owner handoff, then active-only audience sync | CertificationAdmissionLifecycleHandler prepares active exam locks and syncs current audience | TrainingExamOwnershipService, CertificationAssignmentService, CertificationAudienceSyncService | No duplicate automatic reaction; hidden ownership gap fixed |

Handler lists are injected by Spring using Ordered. Schedule=100, Certification=200,
Task=300, Checklist=400, Reminder=500 (termination/position offsets use
HIGHEST_PRECEDENCE). Coordinators reject duplicate module registrations. Module
interpretation resides in handlers/services; coordinators aggregate typed results
without implementing Schedule status rules, Checklist access or Certification cycles.

## Double-execution map

“A” is a coordinator-only lifecycle adapter; “B” is a legitimate shared/domain CRUD
primitive. No “C” second automatic employee reaction was found by caller tracing.

| Consequence | All automatic lifecycle paths | Other production paths | Classification |
|---|---|---|---|
| Remove Schedule participant | Termination → ScheduleTerminationApplyHandler; Position Change → SchedulePositionChangeApplyHandler → removeParticipantWithLocksHeld | Public removeParticipant primitive has no current production caller | A; no second reaction |
| Delete preference submission | Same two exit paths call removeParticipantWithLocksHeld once per affected schedule | SchedulePreferenceLifecycleService explicit collection reset; ordinary preference editing | B; collection CRUD is not employment cleanup |
| Historicalize PUBLISHED row / cancel future cells | ScheduleTerminationApplyHandler; SchedulePositionChangeApplyHandler → PublishedShiftImpactClassifier | No other setHistorical(true) caller | A |
| Transfer Schedule owner | Those two Schedule handlers → reassignOwnedSchedulesWithLocksHeld | ScheduleOwnershipService.changeOwner; ScheduleServiceImpl initial owner | B; lifecycle primitive sends no old synchronous owner notification |
| Transfer Certification owner | CertificationEmployeeLifecycleHandler before termination/position mutation → batchReassignWithLifecycleLockHeld | TrainingExamOwnershipService.changeOwner / assignInitialOwner | B; no automatic fallback |
| Transfer/orphan Task assignee/setter | TaskTerminationLifecycleHandler; TaskPositionChangeLifecycleHandler setter-only | TaskService.create sets initial member links; complete/delete do not reassign | A/B |
| Release Checklist reservations | Termination → releaseActiveReservationsForMember; Position Change → selective item mutations | ChecklistServiceImpl unreserve/complete/undo/reset/edit/delete | B; explicit item operations |
| Detach personal Reminder | Termination → ReminderTerminationLifecycleHandler → detachPersonalTarget | ReminderServiceImpl explicit target editing/delete; dispatch updates fire timestamps | A/B; dispatcher now cannot undo detach |
| Certification audience sync | Admission → CertificationAdmissionLifecycleHandler; Termination/Position Change → CertificationEmployeeLifecycleHandler after member mutation | ExamServiceImpl explicit create/update/hide/restore/material publication → syncExamAudience or assignment sync | B; exam CRUD owns its audience rules |
| Preference participant/new active row | Admission/Position Change Schedule adapters → add/reopen/draft primitives | ScheduleServiceImpl create/update/addMember/start collection | B; every path materializes participation and active row together |

Required primitive search results (definitions/overload delegation are distinguished
from callers):

| Symbol | Runtime callers found |
|---|---|
| detachPersonalTarget | ReminderTerminationLifecycleHandler:20 only; repository declaration |
| releaseActiveReservationsForMember | ChecklistTerminationLifecycleHandler only; repository declaration |
| syncRestaurantAudience | CertificationEmployeeLifecycleHandler:97,103; CertificationAdmissionLifecycleHandler:18; two overload delegates inside the service, no additional external caller |
| removeParticipantWithLocksHeld | ScheduleTerminationApplyHandler:73; SchedulePositionChangeApplyHandler:103; declaration |
| reassignOwnedSchedulesWithLocksHeld | ScheduleTerminationApplyHandler:128; SchedulePositionChangeApplyHandler:86; one service overload delegate and two declarations |
| batchReassignWithLifecycleLockHeld | CertificationEmployeeLifecycleHandler:73,90; declaration |

syncRestaurantAudience calls assignment reconciliation once per active exam; it does
not recursively invoke termination or module cleanup. All three lifecycle callers
pass `false` for old assignment notifications and consume mutation facts for their
operation notifications. Explicit exam publication and audience edits are separate
business operations, not employee-event listeners.

## Legacy findings

| Severity | Finding | Resolution |
|---|---|---|
| P0 | RestaurantServiceImpl.delete checked only other active users. V1 FK `restaurant_member.restaurant_id → restaurants.id ON DELETE CASCADE` could erase ended periods or the actor's period outside Termination | Fixed: serialize against Admission using the lifecycle row; reject deletion if any membership period exists |
| P1 | ReminderDispatchJob loaded/saved mutable Reminder without lifecycle serialization. A concurrent detach could be overwritten by dispatch's stale full entity UPDATE | Fixed: per-restaurant transactional worker acquires restaurant mutex before due-reminder/member reads; failure rolls back that restaurant batch |
| P1 | Checklist termination bulk UPDATE bypassed parent lock used by normal item editing. A stale item edit could flush reservedBy back after release | Fixed: scalar ordered parent-ID discovery, parent locks, then bulk release |
| P1 | Position-change Checklist discovery loaded items before waiting for parent locks, allowing stale managed item state to survive into the later item-lock query | Fixed: scalar parent-ID discovery; items loaded only after parent locks |
| P1 | Hidden Certification excluded from ownership handoff; activation could restore an invalid legacy owner | Fixed under accepted product contract: all extant Certification ownership participates in lifecycle; owner guard blocks invalid activation |
| P1 | Certification lifecycle preview/batch reused manual actor Training scope/container authority, making permitted MANAGER termination or STAFF→STAFF capability loss impossible for STAFF Examiner ownership with MANAGER/ADMIN visibility | Fixed: preview discovers all subject-owned resources; explicit lifecycle transfer trusts coordinator transition authority and validates resource snapshot and replacement eligibility independently of actor manual scope |
| P2 | Requested Phase 6 legacy endpoints/types/bulk wrappers | No active occurrences found; nothing to remove |
| P3 | Migration history and old display metadata contain historical names | Left intact; V115–V119 not modified; no V120 needed for confirmed fixes |

## Fixes applied

- `reminder/job/ReminderDispatchJob.java`: scheduler delegates each restaurant to a proxied worker; catches errors outside each transaction.
- `reminder/service/ReminderDispatchService.java` (new): existing dispatch/content/recipient/schedule calculation moved intact; mutex before reads, one restaurant per transaction. No job-wide set of held restaurant locks. An error aborts that restaurant batch, allowing the next tick to retry consistently.
- `checklist/repository/ChecklistItemRepository.java`: scalar `findReservedChecklistIds` avoids caching reservation entities before waiting.
- `checklist/lifecycle/ChecklistTerminationLifecycleHandler.java`: ordered parent locks before exactly one release primitive.
- `checklist/lifecycle/ChecklistPositionChangeLifecycleHandler.java`: scalar parent discovery before existing selective release; completion history unaffected.
- `member/repository/RestaurantMemberRepository.java`: all-period `existsByRestaurantId` replaces the sole caller's insufficient other-active-member predicate.
- `restaurant/service/impl/RestaurantServiceImpl.java`: lifecycle row lock → all-period history check → delete only empty-employment restaurants.
- New focused tests: ChecklistTerminationLockTest; ReminderDispatchLifecycleTest (termination-winning dispatch and same-User rehire isolation); RestaurantDeletionLifecycleTest (history protection and empty-restaurant deletion).

### Hidden Certification closure correction

- `training/repository/TrainingExamRepository.java`: new ownership queries
  `findOwnedCertificationForLifecycle` and `findCertificationForLifecycleTransfer`
  include every extant CERTIFICATION row regardless of active; deleted exams are
  physically absent. Existing active-only audience/execution queries are unchanged.
- `training/service/TrainingExamOwnershipService.java`: lifecycle discovery and batch
  transfer use those queries. `lockCertificationLifecycleResources` locks the sorted
  union of active audience resources and all resources owned by the subject (including
  hidden); each is refreshed before ownership-state/revision validation. Candidate,
  expected owner/revision and replacement visibility checks remain. Actor/container
  authority remains on manual CRUD; lifecycle transition authority belongs to its coordinator.
- `training/lifecycle/CertificationEmployeeLifecycleHandler.java`: both previews,
  ownership state and both apply-before hooks include active/hidden resources. Missing
  hidden handoff decisions fail before ownership/member mutation. Audience changes
  still resolve only active resources; handoff itself never changes active, assignments,
  specification, cycle, PASSED or attempts.
- `training/service/ExamServiceImpl.java`: restore and update take the restaurant mutex
  before the Certification exam lock/refresh. Owner validation precedes activation,
  assignment restoration and audience synchronization; update activation validates the
  requested final visibility before any content mutation. Invalid owner returns
  `CERTIFICATION_OWNER_INVALID` with the owner-correction message.
- `security/GlobalCreatorPolicy.java` and `auth/controller/AuthController.java`: the
  existing configured-phone CREATOR mechanism is shared between token issuance and
  persisted resource-owner validation. Training contains no duplicated phone/email
  configuration and never uses the actor's CREATOR token or owner==createdBy as proof.
  Valid owners are an eligible active membership or an explicitly configured global
  CREATOR User. Membership-less CREATOR remains excluded from handoff candidates/fallback.
- `training/dto/AppliedCertificationOwnershipTransfer.java` captures active at transfer;
  PositionChangeNotificationService and TerminationNotificationService suppress hidden
  owner-transfer notifications while retaining active owner-transfer notifications.
- `HiddenCertificationOwnershipTest`: focused impact/mandatory-decision, hidden transfer,
  capability loss, sorted locks, legacy owner guards on both activation routes, final
  visibility, valid owner/CREATOR restore, rehire isolation and notification regressions.
- Hidden-resource owner correction uses the existing changeOwner endpoint and UI button.
  `getTrainingErrorMessage` already displays server messages, so no frontend change was needed.

### Cross-scope Certification lifecycle authority correction

- Reproduction: a MANAGER without Examiner may terminate STAFF or move STAFF→STAFF.
  A STAFF Examiner may own Certification visible to MANAGER/ADMIN. Manual Training
  management scope of that MANAGER covers STAFF only. The previous termination preview
  filtered out such exams (or required actor Training authority); apply then rejected
  the missing mandatory decision as stale, or batch handoff rejected actor scope/container.
- Termination preview now maps every active/hidden subject-owned Certification directly
  through `lifecycleCandidates`, matching Position Change's module-owned eligibility.
  No manual actor scope/container filter remains in lifecycle discovery.
- `batchReassignForLifecycleWithLocksHeld` has no actor parameter or security-bypass
  flag. Only the Certification lifecycle adapter invokes it after coordinator authority
  validation and restaurant/member/resource locking. It preserves sorted resource IDs,
  existence, expected owner, mandatory expected revision, distinct transfer IDs,
  new owner different from subject, active restaurant membership, training capability
  and full visibility eligibility. All decisions validate before any owner mutation.
- The unused lifecycle-only `buildReassignmentOptions` path and its manual filtering
  helpers were removed. `changeOwner`, `getOwnerCandidates` and their manual Training
  target/container checks remain unchanged. `ExamServiceImpl.changeCertificationExamOwner`
  still delegates to that restricted manual primitive.
- Hidden active state, assignments, cycle/version engine, restore guard and notification
  suppression are unchanged. Global CREATOR transition authority still uses coordinator
  policies; no synthetic membership or membership-less CREATOR candidate/fallback is added.
- `CrossScopeCertificationLifecycleTest` uses real coordinators, transition policies,
  Certification adapter and ownership policy, mocking persistence and unrelated modules.
  It covers active/hidden termination, active/hidden capability-losing STAFF→STAFF change
  with the same membership, direct manual API target/container refusals, missing handoff,
  invalid candidates, stale owner/revision/missing resource and global CREATOR authority.

## Historical identity audit

| Relation | Authoritative identity | Evidence / rehire result |
|---|---|---|
| Employment period | RestaurantMember | startedAt immutable; endedAt never cleared by runtime; admission always builds new period |
| Task individual assignee / setter | RestaurantMember | Task.assignedMember / setterMember; visibility uses member ID; retained assignedUser is compatibility data, not rehire resolution |
| Task creator / comment author | User | Historical author mapping does not borrow the current setter or later membership; comment list maps author without membership |
| Task position/all assignment | Dynamic Position / active membership audience | Task visibility uses current Position or ALL, rather than historical individual User assignment |
| Checklist reservedBy / doneBy / photo actor | RestaurantMember | Release clears reservedBy/reservedAt only; doneBy/doneAt remain old-period facts |
| Reminder personal target / creator | RestaurantMember | Target comparison is member ID; new period with same User never matches old target; creator history retained |
| Reminder Position / ALL | Dynamic Position / current active membership | Dispatch resolves current active members after mutex |
| Schedule participation / preference submission | RestaurantMember plus Position snapshot | Exit removes children; new admission receives new member ID; no user lookup reuses participation |
| Schedule active/historical row | memberId plus row ID and name/Position snapshots | Active lookup excludes historical; historical row remains bound to old member period |
| Schedule shift request | Row identity + member IDs + shift snapshots | Historical row rejects application via getStaleReason; new candidate lookup requires active row/participation |
| Schedule ownership | ownerMember with explicit User mirror | Initial/change/handoff validates active management member; past resource history may retain old owner |
| Certification result/assignment | User + Restaurant + specification/version/cycle/generation | Intentional user-based exact-cycle reactivation; PASSED/attempt history preserved; no engine redesign |
| Certification ownership | Explicit User; handoff candidates require active eligible membership | Active and hidden ownership transferred by lifecycle; CREATOR initial User ownership preserved; restore guarded; rehire never reclaims transferred resources |

No automatic User→current membership shortcut was found for old individual Tasks,
Task setter, personal Reminder, Schedule participation/row or Checklist reservation.
Certification exact-cycle assignment reactivation is intentionally the User-based
exception. creatorPhones is used for global role/read visibility; it does not create
RestaurantMember. Membership candidate lists start from active member repositories.

## Schedule state matrix and row lookup inventory

| State | Participation / submission on exit | Active row / cells on exit | Historical row | Admission / new-position entry |
|---|---|---|---|---|
| COLLECTING_PREFERENCES | Both removed | Active row removed | Not an operational participant | ADD_TO_COLLECTION or no-add; status remains collecting |
| PREFERENCES_CLOSED | Both removed | Active row removed | Not an operational participant | Explicit reopen with future deadline or no-add; ordinary exit remains closed |
| DRAFT | Participation removed; any submission removed | Active row removed | Never reused by materializer | ADD_TO_DRAFT or DO_NOT_ADD_TO_DRAFT |
| DRAFT_FROM_PREFERENCES | Leaving member children removed | Only leaving row removed; other generated/manual cells preserved; stale marker set | Excluded from generated reset/build | Normal change stale; explicit reopen removes AUTO_BUILD cells, resets applied/stale markers and advances collection cycle |
| PUBLISHED | Leaving member children removed | Past/started cells preserved; future cleared; row marked historical; PUBLISHED retained | Read-only history; no automatic new active row | INFORMATION_ONLY |

All `getRows()` usages were searched repository-wide. Production usages were confined
to the Schedule package. They fall into these reviewed groups:

| Lookup / consumer | Historical filtering or safe role |
|---|---|
| ScheduleRowMaterializer.ensureRowWithLocksHeld | `!historical` lookup; new row instead of historical reuse; all-row max sort-order is presentation only |
| ScheduleTerminationPreviewHandler / ApplyHandler | Active row lookup excludes historical; row-query discovery may include historical schedule IDs, but no historical cell mutation |
| SchedulePositionChangePreviewHandler / ApplyHandler | Old Position row lookup excludes historical; duplicate new-row check excludes historical |
| ScheduleServiceImpl.addMember / active row checks | Only active row prevents duplicate addition; explicit add creates participation and new active row |
| ScheduleServiceImpl.validateAndMapMembers | Historical-only member has no implicit active edit; participation provides authoritative Position; active-member locks precede Schedule |
| buildCurrentValueMap / buildPublishedChanges / applyRowsDiff | Active-only member maps; historical rows retained, only sort order normalized; active payload does not reconcile historical cells |
| ScheduleAutoBuildFingerprintService / AutoBuildApplyServiceImpl | Fingerprint/member row index/generated cell cleanup excludes historical |
| ScheduleShiftRequestServiceImpl | Candidate lookup excludes historical; row-ID lookup is historical identity lookup, followed by getStaleReason rejecting historical application |
| ScheduleServiceImpl.notifySchedulePublished | Active-row member-ID set intersected with participation; no history-only recipient |
| ScheduleServiceImpl.toDto | Published history included for display, uses `-row.id` cell keys; active keys use memberId |
| Frontend table/editor/Today/export/swap/replacement | Historical read-only cells; active-only save payload/candidates; Today uses history:rowId vs member:memberId keys |
| Collection initialization / max sort order | Loads all rows for DTO/ordering; no operational candidate selection |

Committed additions pair participation and active row through ScheduleParticipationCreator
and ScheduleRowMaterializer or ScheduleServiceImpl buildRows/applyRowsDiff. Lifecycle
exits remove participation before row changes inside one transaction. PUBLISHED history
is deliberately allowed without participation. Reset retains participation for resulting
DRAFT rows. No additional DB FK was introduced.

## Concurrency audit

| Boundary | Lock / revalidation |
|---|---|
| Admission | RestaurantLifecycleMutex → contact lock → invitation → Position share → Schedule IDs ASC → Certification IDs ASC; revalidate contact, terminal status, Position snapshot and selected schedule opportunities before new membership |
| Position Change | Restaurant mutex → active target member → target Position share → ordered adapters; member-start/current/target snapshot tokens; Schedule locks refreshed before decision checks; Certification locks refreshed |
| Termination | Restaurant mutex → active target member → ordered adapters; schedule version/status/cycle/deadline/child tokens, Task versions/member identities, Certification owner revision; transaction covers every effect and end |
| Schedule create/update/addMember/start collection/owner change | Restaurant mutex; requested member locks where needed before Schedule; authoritative participant eligibility |
| Preference domain add/remove/reopen | Public primitives currently have no production caller; their member-before-Schedule locks protect employment state; no extra mutex added to reads |
| Schedule auto-build / shift-request apply | Aggregate Schedule lock; active participant/row checks; historical request stale checks; serialization against lifecycle touching same Schedule |
| Task create / assignment | Restaurant mutex; active creator/setter and individual candidate member checks; completion/delete are versioned domain writes, not new assignments |
| Reminder create/update/dispatch | Restaurant mutex before target resolution or loading due entities; dispatch holds it only for one restaurant transaction |
| Checklist reserve | Restaurant mutex → member → parent; termination now ordered parents → reservation update; position-change discovery no longer preloads items |
| Certification create/owner change | Restaurant mutex before owner setup/candidate validation, exam lock/refresh on reassignment |
| Certification update/restore | Restaurant mutex → exam lock/refresh → owner validation → mutation/assignment locks; active-only audience sync; invalid owner cannot become operational |
| Certification ordinary hide/other audience mutations | Exam mutation lock → assignment locks; lifecycle locks the sorted union of active resources and subject-owned active/hidden resources |
| Position definition update | Position write lock; blocks level/specialization mutation for occupied Positions; Admission/Position Change take target Position share lock |
| Restaurant delete | Same restaurant row mutex as Admission → all-period predicate; cannot cascade any employment period |

Unit tests verify selected lock ordering and mutation results; they are not proof of
live PostgreSQL blocking/isolation. The manual plan includes concurrent dispatch,
reservation editing, stale previews and duplicate submits.

## Frontend/API audit

- useMemberRemoval: impact → decisions → one applyEmployeeRemoval request; no handoff-then-remove call.
- useMemberEditPosition: impact → decisions → one applyPositionChange; stale response refreshes preview.
- useInviteForm: invitation impact → inviteEmployee with scheduleIntents; separate invitations API accepts later.
- EmployeeRemoval/PositionChange impact/apply services are thin reachable facades into coordinators.
- EmployeeController and RestaurantController were inspected, including dictionary capability mutation and container deletion.
- Requested Phase 6 endpoints/types have zero matches in production frontend/backend search. No proven legacy frontend export/component remained to delete.

## Events, jobs and notifications

`@EventListener`, `ApplicationListener`, `@TransactionalEventListener` search found
zero matches in production Java. Scheduled production methods were PushDeliveryWorker,
ReminderDispatchJob, InvitationCleanupJob, InboxRetentionJob, InboxRecipientLimitJob
and BirthdayInboxJob. None runs an employee-removal event cleanup. Checklist lazy
reset is an explicit periodic domain reset, not a second termination reaction.

Admission uses one BusinessNotificationOperationId; sender/owner/employee consequences
submit through BusinessNotificationAfterCommitService. Position Change does the same
through PositionChangeNotificationService. Termination registers afterCommit and uses
one UUID for module summaries and its forced-removal direct push; SELF_LEAVE has no
forced-removal push. Ownership primitives return facts rather than calling the normal
CRUD notifications. Certification lifecycle sync suppresses old assignment notification
dispatch. Normal Task create, resource owner change, exam edits and reminder dispatch
retain their own domain notifications.

Hidden ownership transfers carry a non-active mutation fact and produce no new-owner
employee notification. Termination's direct removal push and Position Change's primary
employee notification still describe the employment operation, not hidden audience
activation. Rehire audience reconciliation never writes exam ownership.

After-commit delivery is currently best-effort: a process failure after authoritative
commit can lose a batch. The existing alpha policy explicitly accepts this; no outbox
redesign was performed.

## Remaining risks

1. Live PostgreSQL race scenarios have not been executed.
2. The manual E2E matrix has not been executed.

## Verification

- Initial: `git branch --show-current`; `git status --short` — requested branch, clean.
- `git rev-parse HEAD dev origin/dev` and `git ls-remote origin refs/heads/dev` — all `5e931da…`. First sandbox network attempt failed; read-only retry outside sandbox succeeded.
- `mvn -DskipTests compile` — first bare invocation could not find Maven; cached Maven 3.9.11 with JAVA_HOME=temurin-17.0.15 succeeded. Final compile after restaurant fix also passed.
- Original audit `mvn test`: 54 tests passed. Hidden ownership follow-up: `mvn -DskipTests compile` passed; final `mvn test` passed with **68 tests, 0 failures, 0 errors, 0 skipped**, including 14 focused HiddenCertificationOwnershipTest cases. An intermediate notification test attempted to mock a final record unsupported by this repository's Mockito configuration; it was corrected to use real result records before the successful final run.
- Cross-scope authority follow-up: `mvn -DskipTests compile` passed; final `mvn test`
  passed with **83 tests, 0 failures, 0 errors, 0 skipped**, including 15 new
  CrossScopeCertificationLifecycleTest cases and the existing 14 hidden ownership cases.
  Initial test compilation exposed Java generic inference on conditional exception classes;
  explicit typed class variables corrected the test before the successful full run.
- `pnpm build` — passed (TypeScript, Vite and PWA); `pnpm lint` — passed.
- Frontend was unchanged in the hidden-ownership follow-up; build/lint were not repeated, as requested. Existing hidden owner-change button and server-message display were inspected.
- Frontend, migrations and other lifecycle modules were unchanged in the cross-scope
  correction; frontend verification was not repeated, as requested.
- `git diff --check` — passed, including final repeat. New files were also checked for trailing spaces/tabs.

## Final verdict

**READY_FOR_MANUAL_VALIDATION**. Admission creates an employment period, Position
Change mutates Position inside that period, and Termination ends it through exactly
one authoritative coordinator per transition. Modules own their consequences through
adapters/domain primitives. No second automatic employee lifecycle reaction was found.
Active and hidden Certification ownership now participates in mandatory handoff;
activation rejects invalid legacy owners while preserving explicit CREATOR ownership.
Lifecycle Certification handoff uses coordinator transition authority independently
of actor manual Training scope; replacement eligibility and manual CRUD restrictions remain enforced.
The live DB concurrency and manual UI scenarios remain the next validation step.
