# Employee Lifecycle — manual regression plan

Prepared 2026-10-06 for code review and subsequent human testing. **No scenario below
has been executed as part of this audit.** Current closure verdict is
READY_FOR_MANUAL_VALIDATION. Hidden Certification participates in mandatory lifecycle
ownership handoff and stays hidden; activation rejects invalid legacy owners.

Use a disposable restaurant with ADMIN, MANAGER, two STAFF Positions, replacement
employees, and a global CREATOR without membership. Record actual IDs (User and
RestaurantMember separately), restaurant timezone, browser sessions, resource versions,
invitation status and relevant inbox/push records. Use server/DB evidence to distinguish
duplicate UI rendering from duplicate persisted consequences.

For every scenario fill: **PASS / FAIL / NOT RUN**, backend evidence, UI evidence,
notifications, and Notes. All checkboxes are initially unchecked.

## 1. Basic admission

Preconditions: existing restaurant, manager/admin, STAFF Position, plain DRAFT Schedule.

- [ ] Steps: preview invitation, select ADD_TO_DRAFT, save invitation; inspect state before acceptance; intended User accepts later.
- [ ] Expected backend state: invite creation has no membership or Schedule change; acceptance creates exactly one new member with startedAt/Position; one participation and active row; invite ACCEPTED and acceptedMember points to that period.
- [ ] Expected UI state: employee appears once; active Schedule row appears once; historical row is not reused.
- [ ] Expected notifications: sender/resource owner/required Certification recipients receive their applicable operation groups once after commit; no lifecycle notification before acceptance.
- [ ] Result: PASS / FAIL / NOT RUN. Notes and IDs:

## 2. Invitation decline and expiry

Preconditions: two pending invitations with saved Schedule intents, one expiring shortly.

- [ ] Steps: decline one; let the other expire and run/await expiry materialization.
- [ ] Expected backend state: DECLINED / EXPIRED; no RestaurantMember, Schedule mutation or Certification assignment caused by either invitation.
- [ ] Expected UI state: terminal invitation status, no new employee or row.
- [ ] Expected notifications: applicable invitation terminal sender notification once; no acceptance/module lifecycle notification.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 3. Forced STAFF termination

Preconditions: active STAFF with Schedule participation/preference, sole individual Task,
Checklist reservation, personal Reminder, current Certification assignment; valid replacement.

- [ ] Steps: impact → provide all required decisions → one apply request.
- [ ] Expected backend state: same member ends once; Task transferred; Schedule exit follows state matrix; reservation released; personal Reminder detached/inactive with nextFireAt=null; active Certification audience reconciled; history retained.
- [ ] Expected UI state: employee disappears from operational lists/candidates; replacement has Task; reservation available; old reminder cannot dispatch to employee.
- [ ] Expected notifications: one forced-removal direct push; each applicable task/owner group once; watch persisted duplicates and repeated consequences explicitly.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 4. Self leave

Preconditions: individual Task; setter responsibility if actor has that capability; valid setter replacement.

- [ ] Steps: actor previews own removal, supplies setter transfer if required, applies once.
- [ ] Expected backend state: individual assignment unassigned, compatibility assignedUser cleared; setter transferred; membership ended; no partial state if setter decision missing.
- [ ] Expected UI state: restaurant access disappears immediately; old Task is not returned as actor's individual assignment.
- [ ] Expected notifications: no forced-removal direct push; orphan/setter responsibility groups only where applicable, once.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 5. Manager owner termination

Preconditions: departing manager owns current/future Schedule, active and hidden Certification and Task setter responsibility; eligible replacements.

- [ ] Steps: inspect impact; apply without handoffs; verify rejection; supply decisions and send one atomic apply.
- [ ] Expected backend state: first attempt changes nothing; successful attempt transfers all required ownership/responsibility exactly once and ends membership in the same transaction, including hidden Certification ownership; hidden exam stays active=false with no assignment restoration.
- [ ] Expected UI state: no separate handoff request followed by removal; updated owners shown; ended actor not a candidate.
- [ ] Expected notifications: none from rejected transaction; active resource/new-owner/task notifications and forced-removal push once after success; hidden owner handoff produces no employee notification.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 6. Last ADMIN

Preconditions: exactly one active ADMIN; another Position usable for demotion.

- [ ] Steps: try terminating the last ADMIN; separately try demoting them.
- [ ] Expected backend state: both blocked; no module/membership/audit mutation from failed apply.
- [ ] Expected UI state: meaningful conflict; employee and authority unchanged.
- [ ] Expected notifications: none from either rejection.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 7. Position Change STAFF → STAFF

Preconditions: individual Task, personal Reminder, position-based Task/Checklist/Reminder/Certification audiences; affected Schedule.

- [ ] Steps: impact → choose Schedule action → one apply to another STAFF Position.
- [ ] Expected backend state: memberId and startedAt unchanged; Position changes; individual Task and personal Reminder survive; dynamic audience changes; Checklist reservation released only if new Position loses access.
- [ ] Expected UI state: new Position displayed, dynamic resources match new access; Schedule follows chosen decision.
- [ ] Expected notifications: one position-change group plus only actual preference/shift/owner/Certification consequences, after commit.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 8. MANAGER → STAFF

Preconditions: current Schedule owner, Certification owner whose target capability is lost, Task setter; replacements eligible.

- [ ] Steps: preview demotion; attempt missing handoffs; then supply all mandatory decisions and apply.
- [ ] Expected backend state: failed apply atomic/no changes; successful handoffs before member Position mutation; same memberId; individual Task remains.
- [ ] Expected UI state: old responsibilities transferred, STAFF access applies immediately.
- [ ] Expected notifications: no failed-operation messages; position/new-owner/setter groups once after successful commit.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 9. DRAFT_FROM_PREFERENCES Position Change

Preconditions: applied auto-build with other employees' generated cells and manual edits; two separate fixtures for normal/reopen path.

- [ ] Steps: normal position change without reopen; separately choose explicit reopen/rebuild and a future deadline.
- [ ] Expected backend state: normal path removes leaving active row, preserves other generated/manual data and marks STALE; explicit reopen removes generated AUTO_BUILD result, resets applied/stale markers, reopens collection and advances cycle; preserve manual cells according to accepted contract.
- [ ] Expected UI state: stale draft differs visibly from reopened collection; no incorrect automatic rollback of ordinary change to collection status.
- [ ] Expected notifications: only actual selected preference/owner consequences once; no old generic collection-start notification duplicated with lifecycle notification.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 10. Published Schedule termination

Preconditions: employee row has past, current/started and future shifts; record exact restaurant-local time.

- [ ] Steps: preview termination, inspect future shift count, apply.
- [ ] Expected backend state: past and started shifts preserved; future shifts removed; row historical=true and read-only; participation/submission removed; status stays PUBLISHED.
- [ ] Expected UI state: historical employee facts still visible; old row absent from active/add/remove/shift replacement candidates.
- [ ] Expected notifications: owner summary once with correct cancellation count; forced-removal push if forced; no historical-row publication recipient.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 11. Rehire

Preconditions: period #A has individual Task/setter links, personal Reminder, published history,
Checklist doneBy/history and current-version PASSED Certification. Record all IDs before ending.

- [ ] Steps: terminate #A with valid transfers; invite same User; accept to create #B; optionally add #B to a draft.
- [ ] Expected backend state: #B != #A; #A stays ended; no old Task/setter or Reminder retarget; historical row keeps #A; new active row/participation uses #B; Checklist history keeps #A; same valid PASSED cycle remains valid; new-version behavior follows existing Certification engine.
- [ ] Expected UI state: new employment is operational; old history distinguishable; no duplicate row keys or inherited reservations.
- [ ] Expected notifications: new admission groups once; no old personal Reminder dispatch to #B; no spurious new Certification obligation for still-valid PASSED.
- [ ] Result: PASS / FAIL / NOT RUN. Notes and #A/#B:

## 12. Stale invitation Position snapshot

Preconditions: pending invitation; an unoccupied target Position whose definition can be edited.

- [ ] Steps: save invite; materially edit Position; accept old invitation.
- [ ] Expected backend state: INVITATION_INVALIDATED and no membership/module consequences.
- [ ] Expected UI state: invalidated invitation, employee not added; creator can prepare a fresh invitation.
- [ ] Expected notifications: applicable invalidation sender message once; no acceptance messages.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 13. Stale preview

Preconditions: Termination and Position Change previews in session A; relevant resource editable in session B.

- [ ] Steps: preview A; mutate affected Schedule/Task/Certification owner/version in B; apply old plan A. Repeat for member Position snapshot changes.
- [ ] Expected backend state: stale/conflict, no partial handoffs, row cleanup, member change or committed lifecycle audit.
- [ ] Expected UI state: preview refresh required; current resource state preserved.
- [ ] Expected notifications: none from rolled-back operation.
- [ ] Result: PASS / FAIL / NOT RUN. Notes, conflict code and versions:

## 14. Double submit

Preconditions: same invite or same removal plan open in two browser sessions.

- [ ] Steps: submit acceptance concurrently; repeat with termination concurrently.
- [ ] Expected backend state: one admission/termination effect set; acceptance replay may return same acceptedMember; second removal terminal/conflict; no duplicate member, audits or module consequences.
- [ ] Expected UI state: coherent accepted/ended or conflict status; no duplicate employee.
- [ ] Expected notifications: one group per operation identity; terminal/replay response does not re-notify.
- [ ] Result: PASS / FAIL / NOT RUN. Notes, operation IDs and request timings:

## 15. Historical Schedule isolation

Preconditions: same member has a historical published row from Position exit and an explicitly
added active row where permitted; also test old #A/new #B rows across rehire.

- [ ] Steps: view table/Today/export, edit active payload, inspect replacement/swap candidates,
  publish; separately inspect auto-build fixture containing retained historical data.
- [ ] Expected backend state: historical cells unchanged; active-only generated build/candidate selection; shift requests cannot apply to historical row; historical-only state grants no participation access.
- [ ] Expected UI state: historical row read-only; Today keys distinct; historical cells keyed by row ID, active cells by member ID; no collision or hidden active row.
- [ ] Expected notifications: publication targets only active rows intersecting participation, never history-only employees.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 16. CREATOR without membership

Preconditions: global CREATOR has no RestaurantMember in fixture restaurant.

- [ ] Steps: perform allowed global management actions; inspect assignment/handoff candidates; create Certification.
- [ ] Expected backend state: no synthetic membership; createdBy and initial User owner reflect explicit Certification creator; active-membership handoff candidates do not include membership-less CREATOR; no fallback ownership assignment.
- [ ] Expected UI state: global actions permitted where intended; no ordinary employee/assignment candidate entry created automatically.
- [ ] Expected notifications: normal explicit creation notifications only; no Admission lifecycle notification for CREATOR.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 17. Reminder dispatch vs termination (fixed race)

Preconditions: personal repeating Reminder due now; separate DB/browser sessions or controlled
worker pause; record targetMemberId, active, nextFireAt and job transaction times.

- [ ] Steps: overlap dispatch with termination in both acquisition orders.
- [ ] Expected backend state: termination-winning dispatch loads no due personal target; dispatch-winning operation finishes first and termination then detaches/stops it; after termination commits, no stale save restores target/active/nextFireAt.
- [ ] Expected UI state: reminder remains detached/stopped after refresh; rehire does not revive it.
- [ ] Expected notifications: a dispatch committed before termination is allowed; no dispatch for old period acquired after termination commit; no duplicate same-fire reminder event.
- [ ] Result: PASS / FAIL / NOT RUN. Notes and lock evidence:

## 18. Checklist editing vs lifecycle (fixed race)

Preconditions: departing member reserves an item; another authorized editor updates its text/photo/done state.

- [ ] Steps: overlap parent-locked edit and termination in both orders; repeat position change to inaccessible Position and to still-accessible Position.
- [ ] Expected backend state: no restored reservation for ended/ineligible period; completion facts retained; still-eligible reservation survives Position Change; parent locks acquired before lifecycle item writes.
- [ ] Expected UI state: released item reservable by another active employee; completion/history still visible.
- [ ] Expected notifications: no extra cleanup notification outside lifecycle; failed transaction sends none.
- [ ] Result: PASS / FAIL / NOT RUN. Notes and lock evidence:

## 19. Restaurant delete vs employment history (fixed bypass)

Preconditions: restaurant with only ended periods; another with only CREATOR's own active period;
third restaurant with no employment periods; pending invite in a concurrent fixture.

- [ ] Steps: CREATOR tries deleting each; overlap delete and invitation acceptance on the same restaurant.
- [ ] Expected backend state: history and own-period restaurants rejected; all periods preserved; empty-employment restaurant deletion allowed; mutex orders deletion/Admission so no admitted period is cascaded away.
- [ ] Expected UI state: conflict explains employment history protection; rejected restaurant remains available.
- [ ] Expected notifications: rejected deletion produces no employee-removal notification; losing acceptance cannot create partial membership/consequences.
- [ ] Result: PASS / FAIL / NOT RUN. Notes:

## 20. Hidden Certification lifecycle ownership and activation guard

Preconditions: manager owns active and hidden Certification; eligible replacement available;
separate fixtures for Termination, Position Change and legacy invalid-owner activation.
Include membership-less global CREATOR initial ownership and same-User rehire fixtures.

- [ ] Steps: preview Termination; verify active and hidden owned exams are both listed; omit
  hidden transfer and verify rejection; provide all decisions and apply.
- [ ] Steps: preview capability-losing Position Change; omit hidden transfer and verify rejection;
  provide all decisions and apply. Repeat with a resulting Position retaining capability.
- [ ] Steps: try restoreExam and updateExam(active=false → true) on legacy hidden exams with
  ended, incapable, visibility-ineligible and missing owner. Include ordinary former manager
  where owner==createdBy, and perform activation as CREATOR to ensure actor authority cannot
  substitute for valid resource-owner authority.
- [ ] Steps: correct owner through existing hidden-exam change-owner UI/API; restore again.
  Restore explicit global CREATOR-owned exam without membership. Repeat activation/update
  with a changed final visibility, and overlap activation with owner termination/demotion.
- [ ] Steps: after hidden ownership transfer, rehire the old owner as a new member period;
  verify neither Admission nor audience synchronization returns ownership.
- [ ] Expected backend state: all extant active/hidden CERTIFICATION resources participate in
  mandatory ownership state; transfers preserve active=false, assignments, cycle/version,
  PASSED and attempts. Missing/stale decisions roll back atomically. Resulting Position
  retains ownership only if eligible. Locks follow restaurant → member → Schedule →
  ascending Certification IDs; activation uses restaurant → exam → owner validation.
- [ ] Expected backend state: both invalid-owner activation routes return stable
  CERTIFICATION_OWNER_INVALID before active=true, restoreHiddenAudienceAssignments or
  syncExamAudience; update does not partially change content. Allowed owner is an eligible
  current active member or explicitly configured global CREATOR User; createdBy equality
  is insufficient. Valid owner restore follows the existing Certification engine.
- [ ] Expected UI state: hidden exam remains hidden after handoff; mandatory handoffs appear
  in lifecycle decisions. Invalid restore shows “Перед восстановлением аттестации назначьте
  действующего ответственного.” Existing owner-change action works on hidden resources;
  successful corrected-owner/CREATOR restore makes exam active normally.
- [ ] Expected notifications: hidden handoff produces no employee notification, audience
  activation or assignment restoration. Primary employment notification still applies.
  Active handoff notifications remain once; rejected activation sends none; successful
  explicit restore follows normal domain notification behavior without a duplicate lifecycle message.
- [ ] Expected rehire state: resource remains with replacement owner; no automatic reclaim by
  old User, no synthetic CREATOR membership, no membership-less CREATOR handoff candidate/fallback.
- [ ] Result: PASS / FAIL / NOT RUN. Notes, old/new member IDs, owner IDs and lock evidence:

## Run record

| Field | Tester entry |
|---|---|
| Tested commit / working tree diff | |
| Backend/frontend build, DB migration version | |
| Restaurant timezone and clock | |
| Tester and date | |
| Scenario results and evidence links | |
| Remaining defects / retest results | |

Sign off only after recording backend state, UI and notifications for each scenario.
Static compile/unit/build/lint success does not replace these manual results.
