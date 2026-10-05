# Employee lifecycle Phase 6 — hardening audit

Date: 2026-10-06. Working branch: `feature/phase6-lifecycle-hardening`.
Base: `dev` / fetched `origin/dev` at `0210eb65467ea2fb1446b26a9081e28bba3b67ad`.

This audit covers source, controllers, frontend clients, Spring dependencies, existing lifecycle tests,
and the applied migration chain. It is a static/service-boundary audit, not a live production-data
audit or a PostgreSQL concurrency integration test. No business history was deleted.

## Findings

| Finding | Status | Action | Evidence |
| --- | --- | --- | --- |
| Legacy API: standalone responsibility handoff bypassed atomic termination | Fixed / removed | Remove GET/POST handoff endpoints, injected Spring service, its entire DTO family, frontend API and unreachable dialog | Before removal, `rg -n 'MemberResponsibility' backend/src frontend/staffly-frontend/src` found only references inside the handoff group and EmployeeController. Neither current removal hook nor any test called the standalone flow. Final source search returns zero |
| Dead code: UpdateMemberPositionRequest and EmployeeService.updatePosition | Removed | Delete DTO and permanently throwing interface/implementation method | Repository source search found only declarations; EmployeeController already uses PositionChangeApplyService; dictionary Position editing remains a separate live API |
| Legacy API: CREATOR assign-admin created RestaurantMember directly | Fixed / removed | Delete endpoint/request and RestaurantService method; remove unused User repository dependency | `rg -n 'assignAdmin|assign-admin' backend/src frontend/staffly-frontend/src` found only controller/interface/implementation before removal, no frontend or test clients. After removal AdmissionCoordinator is the only production membership builder |
| Dead code: independent bulk ownership mutation wrappers | Removed | Delete ScheduleOwnershipService.reassignOwnedSchedules and TrainingExamOwnershipService.batchReassign | Their sole callers were the removed handoff service; keep WithLocksHeld primitives used by atomic lifecycle handlers |
| Shared lifecycle DTOs and thin API facades | Retained | Preserve EmployeeRemovalImpactPlan / ApplyEmployeeRemovalRequest types and all four impact/apply facades | Phase 4 uses ownership/candidate/token structures; EmployeeController still injects the facades. Thinness is not evidence of dead code |
| Admission lacked duplicate module validation | Fixed | Add module identity to AdmissionLifecycleHandler and PostConstruct fail-fast validation | AdmissionCoordinator.validateUniqueHandlers; duplicateAdmissionModulesFailBeforeStartup regression; both real admission handlers declare their modules |
| Coordinator/module boundaries | Verified | Keep three separate orchestration coordinators; no generic engine | Source search for ScheduleStatus, TaskStatus, TrainingExam and PreferenceCollectionMode in `*Coordinator.java` under member/lifecycle returns zero |
| LifecycleModule obsolete values | Verified | Preserve all five values | Schedule, Certification, Task, Checklist and Reminder each have real lifecycle handlers |
| Membership identity: Task individual assignee and setter | Verified | Keep assignedMember / setterMember operational; assignedUser / createdBy remain compatibility or historical actor identity | TaskRepository.findActiveByFilters / findActiveResponsibilities use membership IDs; TaskService.create resolves and locks current memberships under restaurant mutex |
| Historical Task comment presentation borrowed current membership by userId | Fixed | Stop resolving historical comment authors to current memberships; do not substitute a rehired actor's current Position | TaskService.listComments now maps immutable User actor with no membership-derived Position; dead resolveMemberOrNull helper removed |
| Membership identity: personal Reminder | Verified | Keep targetMember distinct from dynamic targetPosition | ReminderServiceImpl.isVisible compares membership IDs; ReminderDispatchJob resolves personal recipients by targetMember.id against active members; detachPersonalTarget clears only the ending period's personal target |
| Membership identity: Checklist | Verified | Release reservation without erasing completion/history | ChecklistItemRepository.releaseActiveReservationsForMember updates reservedBy/reservedAt only; doneBy and history retain their original RestaurantMember |
| Rehire and resurrection | Verified | Preserve new-period admission, never retarget old membership relations | AdmissionCoordinator creates a new RestaurantMember with operationNow; existing rehire test preserves old Task references. Production search finds no setEndedAt(null), direct role mutation, or member deletion path |
| Termination preview could select historical row before active row with same memberId | Fixed | Exclude historical rows in preview lookup | ScheduleTerminationPreviewHandler.impact now matches memberId AND !historical, consistent with apply |
| Termination during collecting/closed preferences left active row without participation | Fixed | Remove target active row in both statuses | ScheduleTerminationApplyHandler COLLECTING_PREFERENCES / PREFERENCES_CLOSED branch; published rows still retain history and cancel future shifts |
| External preference removal left active row without participation | Fixed | Remove only the target's non-historical row alongside participant/submission removal | SchedulePreferenceLifecycleService.removeParticipant; targeted regression retains historical row for the same member |
| Preference reset deleted participation while retaining active rows | Fixed | Preserve operational participation when resetting collection state to DRAFT; clear submissions and frozen vocabulary | resetPreferenceCollectionWithLocksHeld; targeted regression checks no aggregate participation deletion |
| Active row Position snapshot could drift from participation | Fixed | Align both existing and newly materialized active row snapshots with participation | ScheduleRowMaterializer and ScheduleServiceImpl.applyRowsDiff; targeted regression preserves old historical Position |
| Ended period could be accepted by participation creation primitive | Fixed | Validate active membership even when participation already exists | ScheduleParticipationCreator validates eligibility before lookup and for every requested member; endedPeriodCannotBecomeParticipant regression |
| Schedule config edit could silently hide active participant Position | Fixed | Reject removing an authoritative participant Position from ordinary edit config | ScheduleServiceImpl.update checks requestedPositionIds before aggregate mutation. A compatible config or lifecycle transition must be used |
| Historical row incorrectly treated as ordinary existing row during update validation | Fixed | Restrict historicalMemberIds to explicitly historical rows | ScheduleServiceImpl.validateAndMapMembers no longer calls every materialized row historical |
| Auto-build could index historical row or clear its cells | Fixed | Index and clear only active rows; fingerprint active row inputs | ScheduleAutoBuildApplyServiceImpl.indexRowsByMember / clearAffectedCells and ScheduleAutoBuildFingerprintService; same-member active+historical regression |
| Preference reopen/reset/invalidation cleared generated historical cells | Fixed | Restrict AUTO_BUILD cleanup and result detection to non-historical rows | SchedulePreferenceLifecycleService generated-cell cleanup streams now filter !historical |
| Pending shift request could mutate rows that became historical | Fixed | Treat either historical row as stale during manager approval | ScheduleShiftRequestServiceImpl.getStaleReason; regression with matching cell snapshot still rejects historical row. Existing member lookup already excluded history |
| Historical row appeared as shift-request UI candidate | Fixed | Filter historical rows before resolving current candidates | ShiftReplacementDialog and ShiftSwapDialog |
| Historical/active same-member Today card keys collided | Fixed | Use history row ID / active membership key and suppress current-member highlighting on history | useScheduleDerivedState.TodayShift and TodayShiftsCard |
| Frontend save excluded historical rows but still sent/validated historical cells | Fixed | Send active rows, active cellValues and active cellShifts only; ignore historical incomplete shifts during editable validation | useScheduleDraftActions.buildPayload / validateScheduleBeforeSave |
| Historical table/render/export identity | Verified | Keep negative historical row-ID cell key, read-only cells, snapshot display and history-after-active sorting | ScheduleServiceImpl.toDto; ScheduleTable / ScheduleTableSection; PublishScheduleConfirmDialog; exporters; useScheduleDerivedState currentMemberInSchedule excludes history |
| Publish notification recipient lookup included historical rows | Fixed | Filter active rows before matching participation recipients | ScheduleServiceImpl.notifySchedulePublished |
| Former employee presentation | Improved | Show `(исключен)` for ended membership Task assignee/setter and Checklist completion actors; keep stored Checklist historical names | TaskService.toUserDto and tasks/utils.ts; ChecklistMapper; ChecklistHistoryMapper prefers doneByName / reservedByName snapshots and keeps original membership IDs |
| CREATOR automatically became certification owner without membership | Fixed | Preserve createdBy User actor, but initial certification owner must resolve to eligible active RestaurantMember; otherwise leave nullable owner unassigned | TrainingExamOwnershipService.assignInitialOwner called after visibility is established; creatorWithoutMembership regression; V52 and TrainingExam already allow nullable owner. Practice User actor semantics remain intact |
| Role authority and invitation desiredRole | Verified / clarified | Keep Position.level authority and compatibility getRole; document desiredRole as display-only | RestaurantMember has no persisted role; Invitation model comment and V119 column comment agree; InviteResponse/MyInviteDto/frontend still consume desiredRole |
| Schedule writes lacked outer lifecycle mutex | Hardened | Acquire restaurant mutex before authority/member/Schedule reads for update, addMember and startPreferenceCollection | ScheduleServiceImpl; create already held it. These boundaries can create participation and rows |
| External responsibility writes | Verified | Preserve restaurant mutex on Schedule owner change/create, Certification owner/create, Task create, Reminder create/update, Checklist reserve | Corresponding service mutation entry points. Preference member mutations use current-member pessimistic locks before Schedule; auto-build and shift requests hold Schedule aggregate lock and validate active participation/rows |
| Certification termination ownership lacked early exam locks | Hardened | Lock/refresh active certification exams before authoritative termination ownership validation | CertificationEmployeeLifecycleHandler.applyBeforeTermination now follows the same ordered exam lock phase as Position Change / Admission |
| External certification owner change lacked aggregate lock | Hardened | Lock and refresh exam before authorization/candidate validation and owner mutation | TrainingExamOwnershipService.changeOwner; previews/getOwnerCandidates remain read-only |
| Lifecycle previews | Verified | Keep preview/impact paths read-only, without restaurant lifecycle mutex or business mutation | TerminateMembershipCoordinator.preview; PositionChangeCoordinator.preview; InvitationImpactService.calculate |
| Lifecycle notifications / operationId | Hardened / verified | Keep after-commit delivery and one operationId; disable direct assignment notifications during termination audience sync | TerminateMembershipCoordinator afterCommit catches failures; PositionChange/Admission use BusinessNotificationAfterCommitService. Certification termination now calls syncRestaurantAudience(..., false) like other lifecycle transitions |
| Lifecycle time consistency | Hardened | Pass context time to Schedule participation/reopen/ownership audit facts | ScheduleAuditService explicit operationNow overload; lifecycle handlers pass context.now / operationNow. Membership boundaries, stale markers and root lifecycle audits already use context time. General entity updatedAt callbacks remain technical persistence timestamps |
| Position snapshot duplication | Verified | Reuse existing comparison rather than introduce DTO redesign | AdmissionPositionSnapshot wraps PositionChangeImpactPlan.PositionSnapshot; normalized payRate and immutable specialization set are shared |
| Stable stale/terminal error codes | Verified / hardened | Preserve EMPLOYEE_REMOVAL_PLAN_STALE, POSITION_CHANGE_PLAN_STALE and INVITATION_INVALIDATED; add code metadata to certification ownership stale conflict | Coordinator/helpers and frontend removal/edit/invitation handlers read code metadata; existing compatibility message fallback is retained |
| Migrations / history | Preserved | No V120; no edits to V115–V119; no FK between snapshot row and participation | `git diff --name-only -- backend/src/main/resources/db/migration` returns empty; no SQL cleanup or production-data changes performed |

## Deletion evidence

Before deletion the legacy symbols were searched across backend source/tests, frontend source,
and repository configuration/migrations. References were either declarations or internal references
within the retired endpoint group. The handoff dialog had no importing component; its API functions
had no callers. assign-admin likewise had no frontend/test/internal caller outside its controller.
No reflective/configuration registration or migration contract references these deleted Java/TS types.
Spring wiring was removed in the same patch as the service and endpoint removal.

Final searches over `backend/src` and `frontend/staffly-frontend/src` return zero for:

```text
responsibility-handoff
UpdateMemberPositionRequest
MemberResponsibilityHandoff
assign-admin / assignAdmin
batchReassign( / reassignOwnedSchedules(
```

`RestaurantMember.builder` has one production occurrence, in AdmissionCoordinator.
Direct `member.setPosition` has one production occurrence, in PositionChangeCoordinator.
There is no production resurrection/null-endedAt or membership deletion path. Historical Flyway
files and earlier phase documents intentionally retain their historical descriptions.

## Behavioral boundaries retained

Invitation remains a plan rather than membership. Admission creates a new employment period;
Position Change preserves membership identity; Termination ends the period. User remains the
correct login, invitation recipient, notification and Certification result identity. Certification
version/cycle/attempt logic was not redesigned. Reopening a User-based Certification obligation
does not retarget old Tasks, Reminders, Schedule rows or Checklist history.

Operational row/participation creation and removal now maintain their invariant at the service
transaction boundary. Published history remains server-owned; old Position snapshots and elapsed/current
published shifts remain retained. Historical rows cannot grant participation or editable shift access.

## Verification

Executed after the final code edits:

| Command | Result |
| --- | --- |
| backend: `mvn -DskipTests compile` | PASS |
| backend: `mvn test` | PASS — 48 tests, 0 failures/errors/skips |
| frontend/staffly-frontend: `pnpm build` | PASS — TypeScript + Vite + PWA |
| frontend/staffly-frontend: `pnpm lint` | PASS |
| repository: `git diff --check` | PASS |

Seven targeted regressions were added: duplicate Admission modules; active/history auto-build isolation;
historical shift-request approval rejection; participation snapshot alignment; preference removal/reset
consistency; ended-period participation rejection; CREATOR initial certification ownership.
Existing lifecycle, rehire, transaction and notification tests remain in the suite.

Maven was invoked by its installed 3.9.11 executable with JAVA_HOME set to the installed Temurin 17.
Final frontend verification used the installed pnpm 10.20.0 entry point directly: Corepack attempted
a registry lookup and the sandbox blocked node_modules realpath; running the installed tool outside
that sandbox completed both commands without dependency installation or package changes.
Existing Lombok builder/deprecation warnings remain unrelated to this patch.

No live database migration, UI browser smoke test or PostgreSQL race test was performed.
Existing development data were not rewritten to invent missing snapshot history.

## Git

Working branch: `feature/phase6-lifecycle-hardening`.

No commit performed. No PR / push performed.
