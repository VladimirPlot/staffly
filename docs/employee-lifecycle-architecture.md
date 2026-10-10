# Employee Lifecycle architecture

Status: accepted / complete, 2026-10-09. See the [milestone](employee-lifecycle.md)
for the release baseline and [validation boundaries](employee-lifecycle-known-deferred-issues.md).

## Identity and transition boundaries

| Concept | Contract |
|---|---|
| User | Persistent person/account identity |
| RestaurantMember | A specific restaurant employment period with `startedAt` and optional `endedAt` |
| Admission | Creates a new RestaurantMember after authoritative invitation validation |
| Position Change | Preserves member ID and employment start; changes Position and operational responsibilities |
| Termination | Ends the current period and applies mandatory exits; does not erase employment history |
| Rehire | Uses the same User and a new RestaurantMember; ended periods never reactivate |
| CREATOR | Global authority without a synthetic membership; not automatically an employee or replacement candidate |

Invitation creation saves an admission plan: Position definition snapshot and selected
Schedule intents. It does not create employment or apply admission effects. Acceptance
revalidates that plan against authoritative state before creating the new period.

## Coordinators and serialization

The production employment writers are `AdmissionCoordinator`,
`PositionChangeCoordinator` and `TerminateMembershipCoordinator` in
`backend/src/main/java/ru/staffly/member/lifecycle/`. Preview is advisory; Apply
checks current authority, employment, Position snapshots and relevant resource tokens.

Position Change and Termination lock `RestaurantLifecycleMutex`, then the relevant
member(s), then ordered module/resource locks. Admission locks the restaurant mutex,
then invitation contact, Invitation, Position (shared), Schedule and Certification;
the new member is created only after preparation. Handlers validate decisions before
applying effects in the coordinator transaction. Related dispatch, Checklist and
Task assignment paths use the restaurant lifecycle mutex where required. New writers
must preserve this ordering and must not mutate employment independently.

Ordered lifecycle modules are Schedule (100), Certification (200), Task (300),
Checklist (400), Reminder (500). These relative orders are shared by the lifecycle
handler infrastructure; they are not a promise that unrelated resource CRUD always
locks every module. Resource CRUD remains legitimate within its own authority.

## Operational state and historical facts

| Module | Operational effect | Preserved history / identity |
|---|---|---|
| Schedule | Remove participation on exit; remove or archive active rows according to state; reconcile preference denominator and build state | `historical=true` rows stay read-only and never become active again |
| Published Schedule | Cancel future shifts, retain started/past shifts, archive departing row; keep Schedule PUBLISHED | Published business facts remain visible |
| Tasks | Reassign mandatory setter responsibilities; transfer/orphan assignees according to lifecycle decisions | Personal assignment can survive Position Change; author, comments and completed history remain |
| Checklist | Release departing member's reservations; deny operations after membership ends | Completed history remains tied to its member identity |
| Reminder | Termination clears personal `targetMember`, disables reminder and clears `nextFireAt` | Old personal reminder does not follow User into a new employment period |
| Certification | Reconcile operational audience and mandatory ownership, including hidden Certification | Results/attempts use User + restaurant + certification version/cycle; valid PASSED may survive Position Change and rehire |

`ScheduleParticipation` is operational identity. A historical ScheduleRow is a
business fact. Returning to a Position creates a new active row; it never resurrects
the historical one. The persistence regression found during final manual validation
was an orphan-removal association problem: deletion must synchronize the managed
Schedule participation collection. The fix was regression-tested and reported
revalidated on PostgreSQL; `SchedulePositionChangePersistenceTest` preserves the
JPA regression and `ScheduleHistoricalIsolationTest` guards historical isolation.

Certification ownership is separate from audience membership. Hidden/restorable
resources still require ownership handoff; activation rejects an invalid owner.
Coordinator-authorized cross-scope handoff does not grant the actor manual Training
CRUD privileges after the transition. CREATOR can administer Training without a
RestaurantMember, but has no automatic employee self-service identity.

## Notifications and workers

Business state is authoritative; lifecycle notification delivery is deferred until
commit and remains best-effort under the existing alpha policy. A process failure
after commit can lose delivery; durable outbox redesign is outside this milestone.

`SchedulingConfig` enables scheduling only with the `worker` profile. The API must
register no scheduled methods. The worker owns InvitationCleanupJob,
ReminderDispatchJob, BirthdayInboxJob, InboxRetentionJob, InboxRecipientLimitJob
and PushDeliveryWorker (conditional on push configuration). Worker Flyway is disabled;
API readiness follows migrations. Operate one worker; profile separation does not
provide distributed exactly-once execution. See the [production checklist](employee-lifecycle-production-checklist.md).
