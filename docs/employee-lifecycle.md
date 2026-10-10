# Employee Lifecycle — COMPLETE

Final milestone recorded 2026-10-09. Technical baseline: `dev` at
`3d6cdfba8354e81fc61f9fee2991c117481baa9d` (merged P3, PR #359).

Staffly has a unified employee lifecycle:
Admission → Position Change → Termination → Rehire. RestaurantMember represents
one employment period, independently of User. Central coordinators validate
authority and optimistic state, serialize restaurant lifecycle changes and apply
mandatory module effects atomically. Historical facts survive operational exit;
rehire creates a new period and does not restore old operational links.

**Employee Lifecycle — ACCEPTED / COMPLETE.** No known critical defect remains
inside the accepted lifecycle scope. This milestone records delivered architecture
and the reported regression results; it is not a claim that production migration,
all scheduled E2E checks or every later UI smoke has been performed.

## Documentation package

- [Architecture and invariants](employee-lifecycle-architecture.md)
- [API and semantic contracts](employee-lifecycle-contracts.md)
- [Manual regression 1–21 and coverage notes](employee-lifecycle-manual-regression.md)
- [Final audit and historical audit evidence](employee-lifecycle-final-audit.md)
- [Known deferred work and validation boundaries](employee-lifecycle-known-deferred-issues.md)
- [Production checklist](employee-lifecycle-production-checklist.md)
- [Detailed migration runbook](production-lifecycle-migration-preflight.md)
- [Read-only migration preflight SQL](production-lifecycle-migration-preflight.sql)

## Delivered closure work

P1 delivered worker-only scheduling, CREATOR/Training authorization consistency
and the fail-fast migration preflight/runbook. P2 delivered saved invitation Position
display, reopen deadline guidance, historical Schedule row presentation, detached
Reminder handling, removal participation preview consistency and orphan Task assignment.
Historical Certification results UI is explicitly deferred for MVP.

[PR #356](https://github.com/VladimirPlot/staffly/pull/356) delivered historical row UX;
[PR #357](https://github.com/VladimirPlot/staffly/pull/357) corrected the row explanation,
added detached Reminder UX and Node 22.13-compatible test loading;
[PR #358](https://github.com/VladimirPlot/staffly/pull/358) added guarded orphan Task assignment;
[PR #359](https://github.com/VladimirPlot/staffly/pull/359) completed P3 housekeeping.

P3 removed unused lifecycle-adjacent repository methods, the obsolete employee invite
client and an orphan frontend test; corrected authority comments and redundant test
dialect configuration; removed transitive commons-logging while keeping spring-jcl.
Intentional historical compatibility paths remain. No functional lifecycle redesign
or migration weakening was included. Live dev fixture rows were retained.

The final P3 validation passed: 226 backend tests, 66 frontend tests on Node 24 and
the pinned Node 22.13, ESLint, TypeScript, production Vite/PWA build and diff checks.
These are the recorded checks for the technical baseline, not new manual E2E evidence.
