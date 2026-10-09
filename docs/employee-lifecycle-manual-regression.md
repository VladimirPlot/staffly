# Employee Lifecycle — manual regression results and rerun recipes

Final status recorded 2026-10-09: **ACCEPTED / COMPLETE**. The table below records
results reported by the project owner from the completed manual regression on
PostgreSQL. This documentation pass did not repeat those runs. Original preparation
was 2026-10-06; exact run timestamps, full HTTP traces and all resource IDs were not
supplied, so none are invented here.

Scenario 5 is overlapping/automated coverage, not a separate full UI session.
Scenario 17 has automated lifecycle race coverage; scheduled worker E2E is deferred.
Other rows record reported PASS. Do not describe this as 21 independently executed
manual UI sessions. Detailed bullets below are rerun recipes, not fresh attestations
that every listed subassertion was individually observed.

| # | Scenario | Recorded result / evidence |
|---|---|---|
| 1 | Basic Admission | PASS; invitation acceptance creates employment and selected operational effects |
| 2 | Invitation decline / expiry | PASS; no admission on decline/expiry |
| 3 | Forced STAFF termination | PASS; mandatory exits, history preserved |
| 4 | Self leave | PASS; sole-assignee task orphaned and setter notified |
| 5 | Manager ownership termination | COVERED; lifecycle regression and Task/Schedule/Certification ownership checks; standalone UI run not performed |
| 6 | Last ADMIN protection | PASS; last administrator removal blocked |
| 7 | STAFF → STAFF | PASS; same employment ID/start, new Position effects |
| 8 | MANAGER → STAFF | PASS; mandatory setter/ownership handoff, personal assignment retained |
| 9 | DRAFT_FROM_PREFERENCES Position Change | PASS; preference/build state reconciled without losing other employees' state |
| 10 | PUBLISHED Schedule termination | PASS; started/past shifts retained, future shifts canceled, row historical, participation deleted |
| 11 | Rehire | PASS; same User, new employment period; old links not restored |
| 12 | Stale invitation Position snapshot | PASS; changed Position invalidates saved offer |
| 13 | Stale preview / Apply | PASS; POSITION_CHANGE_PLAN_STALE and preview refresh |
| 14 | Double submit | PASS; first Apply 200, repeated payload 409 stale, one audit |
| 15 | Historical Schedule isolation | PASS; old historical row never reactivated; new active row created |
| 16 | CREATOR without membership | PASS; global authority without synthetic employment |
| 17 | Reminder dispatch vs termination | AUTOMATED PASS; scheduled worker E2E deferred |
| 18 | Checklist vs lifecycle race | PASS; termination releases reservation, later complete 403, no resurrection |
| 19 | Restaurant delete vs history | PASS; history protected against destructive cascade |
| 20 | Hidden Certification ownership / activation guard | PASS; mandatory handoff and invalid-owner activation protection |
| 21 | Cross-scope Certification handoff | PASS; transition authority allows mandatory handoff without later manual privilege escalation |

## Observed regression highlights

- Reported rehire evidence: User #8, ended member #11, then new periods #14 and #16.
  These IDs are session evidence, not portable fixture IDs or newly queried DB state.
- The ScheduleParticipation persistence defect was found in real PostgreSQL validation,
  corrected by synchronizing the managed orphan-removal association, regression-tested
  and rechecked on PostgreSQL before merge to dev. Historical row isolation remained intact.
- The collection flow covered collecting → Position Change entry → submissions → exit
  and denominator recalculation → stale invitation invalidation → closed collection →
  fresh reopen invitation/accept → revisions → close/build → DRAFT_FROM_PREFERENCES →
  Position Change making the build stale.
- Later P2/P3 automated validation is recorded in the [milestone](employee-lifecycle.md).
  Task assignment JPA tests use H2; they are not PostgreSQL smoke evidence.
- Remaining validation and MVP deferrals are in [known deferred issues](employee-lifecycle-known-deferred-issues.md).

## Rerun recipes

Use two browser sessions for races, record actor/member/resource IDs and relevant
versions, and compare persisted state as well as UI. Notification checks must distinguish
committed business state from best-effort delivery. Steps below remain useful for
future regressions; the result lines refer to the recorded run above.

## 1. Basic admission

Preconditions: existing restaurant, manager/admin, STAFF Position, plain DRAFT Schedule.

- Steps: preview invitation, select ADD_TO_DRAFT, save invitation; inspect state before acceptance; intended User accepts later.
- Expected backend state: invite creation has no membership or Schedule change; acceptance creates exactly one new member with startedAt/Position; one participation and active row; invite ACCEPTED and acceptedMember points to that period.
- Expected UI state: employee appears once; active Schedule row appears once; historical row is not reused.
- Expected notifications: sender/resource owner/required Certification recipients receive their applicable operation groups once after commit; no lifecycle notification before acceptance.
- Recorded result: PASS — admission verified in the reported PostgreSQL regression.

## 2. Invitation decline and expiry

Preconditions: two pending invitations with saved Schedule intents, one expiring shortly.

- Steps: decline one; let the other expire and run/await expiry materialization.
- Expected backend state: DECLINED / EXPIRED; no RestaurantMember, Schedule mutation or Certification assignment caused by either invitation.
- Expected UI state: terminal invitation status, no new employee or row.
- Expected notifications: applicable invitation terminal sender notification once; no acceptance/module lifecycle notification.
- Recorded result: PASS — decline/expiry verified; no employment created.

## 3. Forced STAFF termination

Preconditions: active STAFF with Schedule participation/preference, sole individual Task,
Checklist reservation, personal Reminder, current Certification assignment; valid replacement.

- Steps: impact → provide all required decisions → one apply request.
- Expected backend state: same member ends once; Task transferred; Schedule exit follows state matrix; reservation released; personal Reminder detached/inactive with nextFireAt=null; active Certification audience reconciled; history retained.
- Expected UI state: employee disappears from operational lists/candidates; replacement has Task; reservation available; old reminder cannot dispatch to employee.
- Expected notifications: one forced-removal direct push; each applicable task/owner group once; watch persisted duplicates and repeated consequences explicitly.
- Recorded result: PASS — STAFF termination and module exits verified.

## 4. Self leave

Preconditions: individual Task; setter responsibility if actor has that capability; valid setter replacement.

- Steps: actor previews own removal, supplies setter transfer if required, applies once.
- Expected backend state: individual assignment unassigned, compatibility assignedUser cleared; setter transferred; membership ended; no partial state if setter decision missing.
- Expected UI state: restaurant access disappears immediately; old Task is not returned as actor's individual assignment.
- Expected notifications: no forced-removal direct push; orphan/setter responsibility groups only where applicable, once.
- Recorded result: PASS — self leave and orphan task/notification behavior verified.

## 5. Manager owner termination

Preconditions: departing manager owns current/future Schedule, active and hidden Certification and Task setter responsibility; eligible replacements.

- Steps: inspect impact; apply without handoffs; verify rejection; supply decisions and send one atomic apply.
- Expected backend state: first attempt changes nothing; successful attempt transfers all required ownership/responsibility exactly once and ends membership in the same transaction, including hidden Certification ownership; hidden exam stays active=false with no assignment restoration.
- Expected UI state: no separate handoff request followed by removal; updated owners shown; ended actor not a candidate.
- Expected notifications: none from rejected transaction; active resource/new-owner/task notifications and forced-removal push once after success; hidden owner handoff produces no employee notification.
- Recorded result: COVERED — automated termination regression and overlapping mandatory ownership checks; no independent end-to-end MANAGER termination UI session.

## 6. Last ADMIN

Preconditions: exactly one active ADMIN; another Position usable for demotion.

- Steps: try terminating the last ADMIN; separately try demoting them.
- Expected backend state: both blocked; no module/membership/audit mutation from failed apply.
- Expected UI state: meaningful conflict; employee and authority unchanged.
- Expected notifications: none from either rejection.
- Recorded result: PASS — last ADMIN protection verified.

## 7. Position Change STAFF → STAFF

Preconditions: individual Task, personal Reminder, position-based Task/Checklist/Reminder/Certification audiences; affected Schedule.

- Steps: impact → choose Schedule action → one apply to another STAFF Position.
- Expected backend state: memberId and startedAt unchanged; Position changes; individual Task and personal Reminder survive; dynamic audience changes; Checklist reservation released only if new Position loses access.
- Expected UI state: new Position displayed, dynamic resources match new access; Schedule follows chosen decision.
- Expected notifications: one position-change group plus only actual preference/shift/owner/Certification consequences, after commit.
- Recorded result: PASS — same employment period retained during STAFF → STAFF.

## 8. MANAGER → STAFF

Preconditions: current Schedule owner, Certification owner whose target capability is lost, Task setter; replacements eligible.

- Steps: preview demotion; attempt missing handoffs; then supply all mandatory decisions and apply.
- Expected backend state: failed apply atomic/no changes; successful handoffs before member Position mutation; same memberId; individual Task remains.
- Expected UI state: old responsibilities transferred, STAFF access applies immediately.
- Expected notifications: no failed-operation messages; position/new-owner/setter groups once after successful commit.
- Recorded result: PASS — personal task assignment retained; setter/ownership handoff verified.

## 9. DRAFT_FROM_PREFERENCES Position Change

Preconditions: applied auto-build with other employees' generated cells and manual edits; two separate fixtures for normal/reopen path.

- Steps: normal position change without reopen; separately choose explicit reopen/rebuild and a future deadline.
- Expected backend state: normal path removes leaving active row, preserves other generated/manual data and marks STALE; explicit reopen removes generated AUTO_BUILD result, resets applied/stale markers, reopens collection and advances cycle; preserve manual cells according to accepted contract.
- Expected UI state: stale draft differs visibly from reopened collection; no incorrect automatic rollback of ordinary change to collection status.
- Expected notifications: only actual selected preference/owner consequences once; no old generic collection-start notification duplicated with lifecycle notification.
- Recorded result: PASS — preference/build reconciliation verified.

## 10. Published Schedule termination

Preconditions: employee row has past, current/started and future shifts; record exact restaurant-local time.

- Steps: preview termination, inspect future shift count, apply.
- Expected backend state: past and started shifts preserved; future shifts removed; row historical=true and read-only; participation/submission removed; status stays PUBLISHED.
- Expected UI state: historical employee facts still visible; old row absent from active/add/remove/shift replacement candidates.
- Expected notifications: owner summary once with correct cancellation count; forced-removal push if forced; no historical-row publication recipient.
- Recorded result: PASS — historical shifts/row retained; future shifts canceled and participation removed.

## 11. Rehire

Preconditions: period #A has individual Task/setter links, personal Reminder, published history,
Checklist doneBy/history and current-version PASSED Certification. Record all IDs before ending.

- Steps: terminate #A with valid transfers; invite same User; accept to create #B; optionally add #B to a draft.
- Expected backend state: #B != #A; #A stays ended; no old Task/setter or Reminder retarget; historical row keeps #A; new active row/participation uses #B; Checklist history keeps #A; same valid PASSED cycle remains valid; new-version behavior follows existing Certification engine.
- Expected UI state: new employment is operational; old history distinguishable; no duplicate row keys or inherited reservations.
- Expected notifications: new admission groups once; no old personal Reminder dispatch to #B; no spurious new Certification obligation for still-valid PASSED.
- Recorded result: PASS — reported User #8: ended member #11, new periods #14 and #16.

## 12. Stale invitation Position snapshot

Preconditions: pending invitation; an unoccupied target Position whose definition can be edited.

- Steps: save invite; materially edit Position; accept old invitation.
- Expected backend state: INVITATION_INVALIDATED and no membership/module consequences.
- Expected UI state: invalidated invitation, employee not added; creator can prepare a fresh invitation.
- Expected notifications: applicable invalidation sender message once; no acceptance messages.
- Recorded result: PASS — stale saved Position definition invalidates invitation.

## 13. Stale preview

Preconditions: Termination and Position Change previews in session A; relevant resource editable in session B.

- Steps: preview A; mutate affected Schedule/Task/Certification owner/version in B; apply old plan A. Repeat for member Position snapshot changes.
- Expected backend state: stale/conflict, no partial handoffs, row cleanup, member change or committed lifecycle audit.
- Expected UI state: preview refresh required; current resource state preserved.
- Expected notifications: none from rolled-back operation.
- Recorded result: PASS — stale Apply rejected and preview refreshed.

## 14. Double submit

Preconditions: same invite or same removal plan open in two browser sessions.

- Steps: submit acceptance concurrently; repeat with termination concurrently.
- Expected backend state: one admission/termination effect set; acceptance replay may return same acceptedMember; second removal terminal/conflict; no duplicate member, audits or module consequences.
- Expected UI state: coherent accepted/ended or conflict status; no duplicate employee.
- Expected notifications: one group per operation identity; terminal/replay response does not re-notify.
- Recorded result: PASS — first Apply 200, repeated payload 409; one audit.

## 15. Historical Schedule isolation

Preconditions: same member has a historical published row from Position exit and an explicitly
added active row where permitted; also test old #A/new #B rows across rehire.

- Steps: view table/Today/export, edit active payload, inspect replacement/swap candidates,
  publish; separately inspect auto-build fixture containing retained historical data.
- Expected backend state: historical cells unchanged; active-only generated build/candidate selection; shift requests cannot apply to historical row; historical-only state grants no participation access.
- Expected UI state: historical row read-only; Today keys distinct; historical cells keyed by row ID, active cells by member ID; no collision or hidden active row.
- Expected notifications: publication targets only active rows intersecting participation, never history-only employees.
- Recorded result: PASS — historical row isolated; new active row created on return.

## 16. CREATOR without membership

Preconditions: global CREATOR has no RestaurantMember in fixture restaurant.

- Steps: perform allowed global management actions; inspect assignment/handoff candidates; create Certification.
- Expected backend state: no synthetic membership; createdBy and initial User owner reflect explicit Certification creator; active-membership handoff candidates do not include membership-less CREATOR; no fallback ownership assignment.
- Expected UI state: global actions permitted where intended; no ordinary employee/assignment candidate entry created automatically.
- Expected notifications: normal explicit creation notifications only; no Admission lifecycle notification for CREATOR.
- Recorded result: PASS — global CREATOR operation without synthetic membership.

## 17. Reminder dispatch vs termination (fixed race)

Preconditions: personal repeating Reminder due now; separate DB/browser sessions or controlled
worker pause; record targetMemberId, active, nextFireAt and job transaction times.

- Steps: overlap dispatch with termination in both acquisition orders.
- Expected backend state: termination-winning dispatch loads no due personal target; dispatch-winning operation finishes first and termination then detaches/stops it; after termination commits, no stale save restores target/active/nextFireAt.
- Expected UI state: reminder remains detached/stopped after refresh; rehire does not revive it.
- Expected notifications: a dispatch committed before termination is allowed; no dispatch for old period acquired after termination commit; no duplicate same-fire reminder event.
- Recorded result: AUTOMATED PASS — lifecycle dispatch race regression; actual scheduled worker E2E deferred.

## 18. Checklist editing vs lifecycle (fixed race)

Preconditions: departing member reserves an item; another authorized editor updates its text/photo/done state.

- Steps: overlap parent-locked edit and termination in both orders; repeat position change to inaccessible Position and to still-accessible Position.
- Expected backend state: no restored reservation for ended/ineligible period; completion facts retained; still-eligible reservation survives Position Change; parent locks acquired before lifecycle item writes.
- Expected UI state: released item reservable by another active employee; completion/history still visible.
- Expected notifications: no extra cleanup notification outside lifecycle; failed transaction sends none.
- Recorded result: PASS — reservation cleared, later completion 403, no resurrection.

## 19. Restaurant delete vs employment history (fixed bypass)

Preconditions: restaurant with only ended periods; another with only CREATOR's own active period;
third restaurant with no employment periods; pending invite in a concurrent fixture.

- Steps: CREATOR tries deleting each; overlap delete and invitation acceptance on the same restaurant.
- Expected backend state: history and own-period restaurants rejected; all periods preserved; empty-employment restaurant deletion allowed; mutex orders deletion/Admission so no admitted period is cascaded away.
- Expected UI state: conflict explains employment history protection; rejected restaurant remains available.
- Expected notifications: rejected deletion produces no employee-removal notification; losing acceptance cannot create partial membership/consequences.
- Recorded result: PASS — employment history protected on restaurant deletion.

## 20. Hidden Certification lifecycle ownership and activation guard

Preconditions: manager owns active and hidden Certification; eligible replacement available;
separate fixtures for Termination, Position Change and legacy invalid-owner activation.
Include membership-less global CREATOR initial ownership and same-User rehire fixtures.

- Steps: preview Termination; verify active and hidden owned exams are both listed; omit
  hidden transfer and verify rejection; provide all decisions and apply.
- Steps: preview capability-losing Position Change; omit hidden transfer and verify rejection;
  provide all decisions and apply. Repeat with a resulting Position retaining capability.
- Steps: try restoreExam and updateExam(active=false → true) on legacy hidden exams with
  ended, incapable, visibility-ineligible and missing owner. Include ordinary former manager
  where owner==createdBy, and perform activation as CREATOR to ensure actor authority cannot
  substitute for valid resource-owner authority.
- Steps: correct owner through existing hidden-exam change-owner UI/API; restore again.
  Restore explicit global CREATOR-owned exam without membership. Repeat activation/update
  with a changed final visibility, and overlap activation with owner termination/demotion.
- Steps: after hidden ownership transfer, rehire the old owner as a new member period;
  verify neither Admission nor audience synchronization returns ownership.
- Expected backend state: all extant active/hidden CERTIFICATION resources participate in
  mandatory ownership state; transfers preserve active=false, assignments, cycle/version,
  PASSED and attempts. Missing/stale decisions roll back atomically. Resulting Position
  retains ownership only if eligible. Locks follow restaurant → member → Schedule →
  ascending Certification IDs; activation uses restaurant → exam → owner validation.
- Expected backend state: both invalid-owner activation routes return stable
  CERTIFICATION_OWNER_INVALID before active=true, restoreHiddenAudienceAssignments or
  syncExamAudience; update does not partially change content. Allowed owner is an eligible
  current active member or explicitly configured global CREATOR User; createdBy equality
  is insufficient. Valid owner restore follows the existing Certification engine.
- Expected UI state: hidden exam remains hidden after handoff; mandatory handoffs appear
  in lifecycle decisions. Invalid restore shows “Перед восстановлением аттестации назначьте
  действующего ответственного.” Existing owner-change action works on hidden resources;
  successful corrected-owner/CREATOR restore makes exam active normally.
- Expected notifications: hidden handoff produces no employee notification, audience
  activation or assignment restoration. Primary employment notification still applies.
  Active handoff notifications remain once; rejected activation sends none; successful
  explicit restore follows normal domain notification behavior without a duplicate lifecycle message.
- Expected rehire state: resource remains with replacement owner; no automatic reclaim by
  old User, no synthetic CREATOR membership, no membership-less CREATOR handoff candidate/fallback.
- Recorded result: PASS — hidden ownership handoff and activation guard verified.

## 21. Cross-scope Certification handoff by MANAGER

Preconditions: actor is MANAGER without Examiner; target is STAFF Examiner; resulting
Position is STAFF without Examiner. Target owns active and hidden Certification with
MANAGER/ADMIN visibility inside a folder the actor cannot manage manually. Replacement
is an active member whose Examiner Position can own the full visibility scope.

- Steps: as this MANAGER, try ordinary Certification change-owner API/UI; verify
  manual scope refusal. Separately test an exam within actor scope in an inaccessible
  folder to verify the manual container restriction remains enforced.
- Steps: preview and apply target Termination with all mandatory owner decisions.
  Repeat on a separate fixture for STAFF Examiner→STAFF without Examiner Position Change.
- Steps: omit a transfer; choose departing owner, ended/non-member, non-manager
  non-Examiner or visibility-ineligible replacement; change owner/revision after preview.
- Expected backend state: both previews include every required active/hidden exam
  regardless of actor manual scope/container authority. Valid mandatory transfers succeed
  under coordinator authority. Termination ends the period; Position Change preserves
  member ID and startedAt. Invalid/missing/stale decisions roll back ownership and employment.
- Expected backend state: hidden remains active=false; no assignment restoration or
  cycle/version/PASSED/attempt changes. Ordinary manual target/container checks still reject.
- Expected UI state: complete mandatory ownership list and only eligible candidates;
  permitted lifecycle operation completes while ordinary manual owner editing stays restricted.
- Expected notifications: primary lifecycle notification applies; hidden owner handoff
  sends no Certification notification; active handoff follows existing notification behavior.
- Recorded result: PASS — cross-scope mandatory handoff without manual authority escalation.

## Template for a future rerun record

| Field | Tester entry |
|---|---|
| Tested commit / working tree diff | |
| Backend/frontend build, DB migration version | |
| Restaurant timezone and clock | |
| Tester and date | |
| Scenario results and evidence links | |
| Remaining defects / retest results | |

For a future rerun, sign off after recording backend state, UI and notifications for each scenario.
Static compile/unit/build/lint success does not replace these manual results.
