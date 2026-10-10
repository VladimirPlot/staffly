# Phase 5 — Admission, invitations and rehire

## Contract and architecture

`Invitation` is an authorized, persisted plan for a future employment period. Creating,
replacing, declining, cancelling or expiring a plan does not mutate Schedule or create
RestaurantMember. The TTL remains 48 hours. EmployeeServiceImpl delegates commands to
InvitationCommandService and acceptance to AdmissionCoordinator; existing API endpoints
and MemberDto remain compatible.

```text
read-only preview -> save invitation snapshot/intents -> employee accept
-> RestaurantLifecycleMutex -> Invitation PESSIMISTIC_WRITE -> validate contact/status/TTL
-> check no active membership -> Position PESSIMISTIC_READ and full snapshot comparison
-> Schedule prepare (mutating IDs ASC) -> Certification prepare (exam IDs ASC)
-> NEW RestaurantMember(startedAt = operationNow)
-> Schedule apply -> Certification audience sync -> Invitation.ACCEPTED + acceptedMember
-> commit -> BusinessNotificationAfterCommitService
```

AdmissionApplyContext carries one operationNow and operationId. All module preparations
only lock and validate; all persistent consequences share the acceptance transaction.
A confirmed plan invalidation is converted before membership creation to the intentional
no-rollback InvitationInvalidatedException: INVALIDATED commits and the API returns a
friendly conflict. Expiry similarly commits EXPIRED. Technical prepare/apply failures
roll back and leave the persisted invitation PENDING. Retrying a successful token for
the same User returns its acceptedMember without creating another membership.

## Position and authority

AdmissionPositionSnapshot stores positionId and the same typed definition used by
Position Change: name, level, specializations, payType, payRate and normHours. Pay-rate
scale and specialization order do not create false conflicts. Acceptance holds a share
lock on the Position and compares its full current definition and restaurant identity.
Missing, inactive, moved or changed Positions invalidate the plan; no fallback is used.
Position dictionary update/delete now take the matching write lock before validation.
This prevents an editor from checking that no employee exists, waiting behind admission,
and then changing permission shape using that obsolete check; it also protects edits
that only change the specialization collection.
Legacy desiredRole remains display metadata and never determines membership access.

At creation the existing manager/admin/creator rules remain: MANAGER can invite only
STAFF, ADMIN and CREATOR can invite any Position. Creation holds a Position share lock
while validating authority and capturing the snapshot. Acceptance does not recheck the
inviter's current employment or authority. No synthetic creator membership is created.

## Schedule decisions

| Current state | Available invitation decisions | Effect after acceptance |
| --- | --- | --- |
| COLLECTING_PREFERENCES | ADD_TO_COLLECTION / DO_NOT_ADD | New participation and row; optional deadline extension |
| PREFERENCES_CLOSED | ADD_AND_REOPEN_COLLECTION / DO_NOT_ADD | Add employee and reopen, preserving collected input |
| DRAFT_FROM_PREFERENCES | ADD_AND_REOPEN_FOR_REBUILD / DO_NOT_ADD | Reopen via shared primitive and clear generated build result |
| DRAFT | ADD_TO_DRAFT / DO_NOT_ADD_TO_DRAFT | Use addDraftParticipantWithLocksHeld |
| PUBLISHED | INFORMATION_ONLY | No automatic row |

ScheduleAdmissionLifecycleHandler ignores non-mutating intents, including deleted or
changed schedules. It locks mutating schedules in ascending ID order, recomputes the
opportunity and checks current action eligibility, target Position, preference mode,
frozen shift vocabulary and deadlines. An unrelated version/cycle bump alone does not
invalidate admission. A required schedule disappearing or becoming incompatible does.
Reopen deadlines must still be future at accept. A supplied collection deadline must
be future and must not shorten the current deadline. An already expired collection
cannot accept a new participant without a valid saved extension.

The stored version/status/cycle/deadline/mode describe planning state. Creating a plan
uses read queries, never Schedule PESSIMISTIC_WRITE or lifecycle mutation primitives.
The retired invitation-time reopen/deadline methods were removed. Frontend decisions
explicitly describe effects conditional on acceptance and offer draft addition.

## Rehire and dynamic modules

Rehire always inserts a new RestaurantMember ID and never clears an old endedAt.
New schedule primitives receive the new membership and snapshot its Position; old
participations and historical published rows retain the old ID. Old individual Task
assignments/setters, personal Reminders and Checklist reservations are not searched,
copied or retargeted. Current Position/all-employee audiences work dynamically; these
modules therefore need no artificial admission handlers. Historical employment does
not itself grant current access.

CertificationAdmissionLifecycleHandler locks active exams deterministically, then uses
the existing version/cycle-aware CertificationAudienceSyncService. A canonical PASSED
in the current version and assignment cycle survives audience re-entry without a new
obligation. A new current version receives its normal current obligation; an old pass
is not applied to it. Existing unfinished-state rules remain owned by that engine.
Acceptance disables legacy synchronous assignment notifications. New certification
requirements and sender/resource-owner summaries are submitted after commit under the
same admission operationId. Employee requirement notifications use a system actor to
avoid the generic self-action suppression. Missing former sender membership suppresses
its notification using the existing rules, without blocking admission.

## Replacement and concurrency

Creation takes a PostgreSQL transaction advisory lock scoped to restaurant + canonical
contact before selecting/replacing PENDING. This also covers the absence of a pending
row. A live prior plan becomes SUPERSEDED; an expired prior plan becomes EXPIRED; both
remain historical. The existing partial unique index on restaurant and lower(contact)
continues to enforce one current PENDING plan. Phone formatting is normalized and
email uses locale-independent lowercase; legacy invitation contacts are normalized by
V119. Candidate lookup supports canonical comparison to historical User phone formats.

Acceptance starts with the restaurant mutex, followed by invitation, Position share,
Schedule ASC, Certification exam ASC and ordered certification assignment locks. Two
accepts of the same token serialize and the second observes ACCEPTED. Different tokens
for the same User serialize; the second invalidates after seeing an active membership.
The existing active-membership partial unique index remains a final database safeguard.
No handler introduces Schedule -> Restaurant lock acquisition.

## Migration

V119 adds Position JSON snapshots and accepted_member_id, supports SUPERSEDED and the
draft actions, and requires a snapshot for PENDING. Historical snapshots cannot be
safely reconstructed: pre-Phase-5 pending plans already changed schedules at creation.
V119 expires elapsed legacy plans and invalidates other legacy pending plans. Managers
must send fresh invitations. It deliberately leaves those production schedules intact.
Applied Phase 1–4 migrations are unchanged.

## Verification

Executed backend compile, backend tests, frontend build/lint, git diff --check and
static searches for invitation-time Schedule mutations and membership reactivation.
The first ordinary Maven test run and the first non-forked attempt were interrupted
while Mockito attempted JVM attachment in restricted Windows. The test-only reflection
MemberAccessor resolves that attachment requirement; non-forked tests then passed.
PostgreSQL integration and migration execution were not performed: Docker Engine was
not running. The concurrency test exercises a serialized mutex with mocked repositories,
and transaction tests exercise Spring's transaction interceptor, not database rollback.
The final ordinary `mvn test` passed 40 tests (0 failures/errors), including existing
Phase 4 tests and 18 new admission scenarios. Commands run from backend were
`mvn -DskipTests compile`, `mvn test`, and `mvn -DforkCount=0 test`; frontend commands
were `pnpm build` and `pnpm lint`. `git diff --check` passed.

Working branch: feature/phase5-admission. No PR, commit or push was performed.
