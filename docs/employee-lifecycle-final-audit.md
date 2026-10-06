# Employee Lifecycle — final architecture audit

## Executive verdict

**NOT_READY** — 2026-10-06. Three confirmed defects are fixed locally. One concrete
Certification ownership edge case still needs a product decision before closure:
hidden Certification → owner termination/demotion → restore. This report does not
claim that manual E2E or PostgreSQL concurrency scenarios were executed.

Audited revision: `5e931da52f00ebccdbfc60d29bb12f5686017c16`, plus this working tree.
Branch: `feature/employee-lifecycle-final-audit`. Initial working tree was clean.
HEAD, local dev and origin/dev matched; read-only `git ls-remote origin refs/heads/dev`
also confirmed that exact remote SHA. No commit, push, reset, merge or rebase was run.

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
| Certification | CertificationEmployeeLifecycleHandler: active owner handoff, then audience sync after end | Same adapter: capability-aware active owner handoff, then audience sync | CertificationAdmissionLifecycleHandler prepares exam locks and syncs new audience | TrainingExamOwnershipService, CertificationAssignmentService, CertificationAudienceSyncService | No duplicate automatic reaction; hidden restore policy unresolved |

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
| P1 / policy unresolved | Hidden Certification is excluded from active owner handoff and restored without owner capability/membership validation | See Remaining risks; no speculative semantics applied |
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
| Certification ownership | Explicit User; handoff candidates require active eligible membership | CREATOR initial createdBy/owner preserved without synthetic membership; hidden-restore gap remains |

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
| Certification ordinary audience edit/hide/restore | Exam mutation lock → assignment locks; lifecycle uses same exam locks. Hidden restore lacks a current-owner employment/capability contract |
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

After-commit delivery is currently best-effort: a process failure after authoritative
commit can lose a batch. The existing alpha policy explicitly accepts this; no outbox
redesign was performed.

## Remaining risks

1. **Hidden Certification ownership**: findActiveOwnedCertificationExams excludes
   `active=false`. Termination/demotion therefore does not hand off a hidden exam.
   ExamServiceImpl.restoreExam (and updateExam changing active to true) makes it active
   without validating its existing owner as an eligible current employee. That can
   revive operational ownership by an ended/incapable User. Two plausible policies
   exist: include hidden resources in mandatory lifecycle handoff, or require explicit
   owner correction before activation. The acceptance matrix does not select one;
   changing it speculatively could break intentional CREATOR initial User ownership.
   A user decision was requested. This is a closure blocker, not merely a naming issue.
2. Live DB races and the 16 UI scenarios remain unexecuted. These are the intended
   manual-validation work after code review, with extra targeted race scenarios below.

## Verification

- Initial: `git branch --show-current`; `git status --short` — requested branch, clean.
- `git rev-parse HEAD dev origin/dev` and `git ls-remote origin refs/heads/dev` — all `5e931da…`. First sandbox network attempt failed; read-only retry outside sandbox succeeded.
- `mvn -DskipTests compile` — first bare invocation could not find Maven; cached Maven 3.9.11 with JAVA_HOME=temurin-17.0.15 succeeded. Final compile after restaurant fix also passed.
- `mvn test` using that cached executable — final run after all fixes: **54 tests, 0 failures, 0 errors, 0 skipped** (including five focused regression tests).
- `pnpm build` — passed (TypeScript, Vite and PWA); `pnpm lint` — passed.
- `git diff --check` — passed, including final repeat. New files were also checked for trailing spaces/tabs.

## Final verdict

**NOT_READY** until hidden Certification activation/ownership policy is resolved and
implemented. Confirmed local fixes remove the discovered dispatch/reservation races
and destructive container cascade path. Current runtime has one authoritative
orchestrator per employee transition, and no parallel automatic cleanup listener,
endpoint, job or service was found. The unresolved activation shortcut prevents the
stronger claim that every operational responsibility remains valid after lifecycle.
