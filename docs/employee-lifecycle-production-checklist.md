# Employee Lifecycle production checklist

Release baseline: [Employee Lifecycle COMPLETE](employee-lifecycle.md), 2026-10-09.
This is an unexecuted operator checklist, not a production deployment report.
The [migration runbook](production-lifecycle-migration-preflight.md) and
[read-only SQL](production-lifecycle-migration-preflight.sql) are authoritative for
commands, reconciliation rules and recovery. Do not weaken V115 or bypass readiness.

## Before deployment

- [ ] Select the exact tested release and validate required production configuration
  without printing secrets. Use `prod` for API, `prod,worker` for worker; no dev profile.
- [ ] Stop worker and all writers according to the runbook. Confirm no independently
  running worker can continue against a migrating database.
- [ ] Take a production backup and verify restoration. Preserve the original backup
  and record the current schema/release.
- [ ] Run read-only preflight against the legacy schema, including CREATOR candidates,
  null/mismatched Position, audit provenance, Task employment mapping and Schedule rows.
- [ ] Obtain an approved disposition for each review finding. All blocker counts must
  be zero and the V117 detail report empty. Synthetic CREATOR candidates are not
  automatic deletion targets; prove absence of business history and needed references.
- [ ] Reconcile only under the recorded operator change plan; preserve true employment
  and history. Repeat preflight and take a verified reconciled backup.
- [ ] Restore to an isolated PostgreSQL 16 environment with separate credentials,
  volumes, names and routes. Disable external delivery and use safe rehearsal settings.
- [ ] Rehearse V115–V119 with the exact release API first, then one worker. Record
  migration/startup duration, readiness, schema validation, job registration and smoke.
  Failed or unsafe rehearsal blocks deployment.

## Deployment ordering and smoke

- [ ] Keep writers and worker stopped; validate Compose configuration. Start DB and
  API first with a timeout justified by rehearsal.
- [ ] Verify successful Flyway through V119 for this baseline, no failed history,
  Hibernate validation and internal `/api/ready` HTTP 200. Update the expected migration
  version for a later release rather than assuming V119 remains latest.
- [ ] Start exactly one worker only after API readiness. Verify worker Flyway disabled,
  no web server, and profile separation. Restore frontend/proxy and controlled traffic.
- [ ] Verify API registers zero scheduled methods; worker registers the five cron jobs
  and conditional PushDeliveryWorker. Observe dispatch SQL/locking health. Registration
  does not prove exactly-once delivery across failures or multiple workers.
- [ ] Verify public `/api/ready` and suffixes return 404, internal readiness works,
  and public `/api/ping` returns `pong`.
- [ ] Use designated smoke accounts: CREATOR administration without membership,
  employee list, fresh invitation preview/save/accept, Position Change preview and
  authorized Training read. Clean smoke employment through approved application flows.
- [ ] Record release, schema, operators, timestamps and evidence. Complete outstanding
  [scheduled/UI validation](employee-lifecycle-known-deferred-issues.md) in the appropriate
  environment; do not silently mark deferred scenarios as passed.

## Failure handling

Keep worker and traffic stopped. Preserve logs and Flyway history; determine which
migrations committed. Do not alter migration checksums/history or run repair to hide
failure. A previous image may be incompatible with the migrated schema. Use an
approved forward fix or restore a verified backup with matching images into an isolated
replacement database, preserving/reconciling later writes as required. Repeat readiness
and smoke before restoring traffic. See the runbook's recovery procedure.
