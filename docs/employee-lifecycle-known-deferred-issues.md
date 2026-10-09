# Employee Lifecycle — deferred work and validation boundaries

Recorded 2026-10-09. These items do not reopen the accepted lifecycle architecture.
No known critical lifecycle defect is recorded. New failed evidence must be triaged
on its actual impact rather than assumed covered by the milestone.

| Item | Current evidence | Remaining work / closure criterion |
|---|---|---|
| Scenario 5 standalone MANAGER termination | Termination regression and overlapping Task, Schedule and Certification mandatory handoff checks passed | Optional standalone UI run for a literal independent 21-scenario journal; record actor, replacements and final state |
| Scenario 17 scheduled Reminder E2E | Lifecycle dispatch/termination regression passed; shared mutex protects the race | Run worker scheduled dispatch against termination on PostgreSQL and record serialization/no delivery after departure |
| Later P2 UI smoke | PR #357/#358 automated checks passed; Task persistence coverage is H2, not PostgreSQL | Browser/PostgreSQL smoke for detached Reminder explicit retargeting, historical row explanation and orphan Task assignment/stale retries; record results separately |
| Historical Certification results UI | Historical results are preserved by backend; current MVP does not require a full history screen | Deferred product functionality; define screen scope when scheduled |
| Production migration execution | Fail-fast preflight SQL, runbook and deployment ordering delivered | Operator backup, read-only reconnaissance, approved reconciliation, restored-copy rehearsal, deployment and smoke still required |
| Dev regression fixtures | No interfering fixture seeds found in repository; live data retained | Optional cleanup of temporary users, Positions, Schedules and Checklists through approved application flows after smoke; preserve useful evidence/history |
| Durable notification delivery | Existing after-commit best-effort alpha policy retained | Outbox/recovery work if a later delivery guarantee requires it; not implemented by this milestone |

Names reported for temporary fixtures include `Тест приглашения...`,
`Hidden Lifecycle Test`, `Cross Scope Lifecycle Test` and `Тест Экзаминатор`.
Their current presence in a live database was not rechecked or deleted in P3.

The 226 backend / 66 frontend test baseline and successful builds validate the
delivered code. They do not replace these environment-specific checks. See the
[regression evidence](employee-lifecycle-manual-regression.md) and
[production checklist](employee-lifecycle-production-checklist.md).
