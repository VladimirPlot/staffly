# Production lifecycle migration preflight (V114 → V119)

Use a maintenance window and the exact release images/configuration rehearsed below.
Commands are POSIX shell examples run from the repository root with Docker Compose v2.
Keep the existing Compose project name (`-p <existing-name>` if used in production),
environment file and volumes. Never use `down -v`. Protect backup/report files as personal data.

## Preconditions and migration audit

- V115 requires every member's non-null Position to exist, belong to the same
  restaurant, and have `level IS NOT DISTINCT FROM member.role`. Inactive Positions
  are allowed by this migration; it does not require `is_active=true`.
- All existing memberships become active (`ended_at=NULL`), so `(user_id,
  restaurant_id)` must be unique. The V2 uniqueness normally already guarantees this.
- Each V104 audit's old AND new Position must exist with non-null name and level.
  Those references have no Position FKs. Both joins must match for V115 to backfill
  snapshots. Audit restaurant mismatch is additional review, not a V115 predicate.
- V115 assumes the normal V114 schema and intact earlier migrations/FKs. It renames
  `created_at` to `started_at`, removes member role/avatar, adds period fields,
  replaces uniqueness, and makes audit snapshots mandatory. Do not edit V115.
- V104–V107 provide historical schedule rows, removal audit, admission schedule
  intents and invalidated invitation status. If upgrading from earlier than V114,
  first rehearse that complete migration chain; this preflight targets V114.
- V116 adds paired nullable stale-provenance fields; no existing-data blocker.
- V117 requires exactly one period containing task creation for EVERY non-null
  assignee/author, including completed/deleted tasks. Active undeleted tasks cannot
  reference ended periods. Before V115, the report projects `created_at` as the start
  and no end; after V115 run `employee-lifecycle-phase3-task-reconnaissance.sql`.
  A global CREATOR who authored a legacy task can still cause a V117 blocker: do not
  invent a synthetic membership to bypass it. Escalate unresolved history explicitly.
- V118 replaces schedule-row uniqueness with active, nonhistorical uniqueness;
  intact V91's stronger old constraint already guarantees the new index can build.
- V119 expires/invalidates every pending legacy invitation and normalizes contacts.
  Pending plans must be created again through the new authorized path; schedules
  previously changed by those plans are not undone. Review this operational impact.

The old phase1 reconnaissance omits missing non-null Position IDs and audit snapshot
failures, has no protected transaction/schema gate, and does not project V117 task
blockers. Use `production-lifecycle-migration-preflight.sql` as the production gate.

## Prepare, back up, reconcile

1. Freeze user traffic and all external writers. Stop worker FIRST, then API and
   proxy/frontend; an already running worker is not stopped by `depends_on`.

   ```sh
   docker compose -f infra/docker-compose.prod.yml stop backend-worker
   docker compose -f infra/docker-compose.prod.yml stop caddy frontend backend
   docker compose -f infra/docker-compose.prod.yml up -d --wait db
   mkdir -p backups
   docker compose -f infra/docker-compose.prod.yml exec -T db \
     pg_dump -U app -d staffly -Fc > backups/staffly-before-lifecycle.dump
   ```

2. Verify dump command success, non-empty archive, and a successful restore to an
   isolated database. Record release/image IDs, effective profiles, Flyway history,
   DB TimeZone, backup checksum/location and any existing pending invitations.
   Preserve the initial untouched backup; make a second backup after reconciliation.
3. Copy the preflight SQL to a protected working copy and replace its creator-phone
   placeholder with ALL effective `app.creator.phones` values, e.g.
   `VALUES ('+79990000001'), ('+79990000002')`. `GlobalCreatorPolicy` matches phones;
   hidden emails and null positions alone do not prove CREATOR authority. An
   unedited placeholder produces no creator detections and is not a valid review.
4. Run against the V114 primary with writers still stopped. `-X` ignores psqlrc,
   `ON_ERROR_STOP` makes SQL/schema failures abort, and the SQL enforces a stable
   read-only transaction. Use the database's migration-session TimeZone; legacy task
   `created_at` is a timestamp without time zone, membership starts are timestamptz.

   ```sh
   docker compose -f infra/docker-compose.prod.yml exec -T db \
     psql -X -U app -d staffly -v ON_ERROR_STOP=1 \
     < /secure/path/preflight-reviewed.sql > backups/lifecycle-preflight.txt
   ```

5. Review every non-zero anomaly and every returned task/audit/creator detail.
   All blocker counts must be zero and the V117 detail report empty. Creator and
   pending-invitation rows are review findings, not automatic deletion criteria.
   Save approved disposition for each; a clean report is necessary, not sufficient.
6. Reconcile manually under a recorded change plan, with explicit operator approval.
   Confirm identity, true employment, position history, tasks, schedules, training,
   invitations and inbound FK delete rules. Audits' member IDs and legacy task
   user/restaurant references may lack membership FKs. A candidate synthetic row
   is removable only after proving it has no business history or needed references.
   Preserve real employment/history; before V115 there is no `ended_at` column,
   so do not blindly issue a period-closing update. Do not change a shared Position
   level just to align a legacy role. Escalate ambiguous records rather than guessing.
7. Re-run the entire preflight after each approved correction until blockers are
   zero and all review findings have a signed disposition. No automated repair is
   included. Take and verify the reconciled backup for the deployment/rehearsal.

## Rehearse on a restored production copy

8. Restore the reconciled backup to a separate PostgreSQL 16 database/network with
   no production volume, credentials or routes. Do not run the production Compose
   file under a new project name blindly: fixed `container_name` values collide.
   Use an isolated host or an explicitly reviewed rehearsal Compose override with
   unique names, volumes, DB configuration and ports. Supply safe S3/push settings;
   disable external delivery with `PUSH_ENABLED=false` and never contact real users.
9. Repeat preflight on the restored V114 DB. Start only the exact release API with
   `prod`, run Flyway V115–V119, verify readiness/schema history and post-V115 task
   reconnaissance, then start ONE `prod,worker` instance. Exercise the smoke below.
   Record duration and errors, including slow migrations, healthcheck timeouts and
   worker SQL. An unsafe or failed rehearsal blocks production deployment.

## Deploy and verify

10. Keep worker and writers stopped. Build/pull the rehearsed release, validate
    `docker compose -f infra/docker-compose.prod.yml config --quiet`, and start API
    first (timeout must cover measured migration/startup duration):

    ```sh
    docker compose -f infra/docker-compose.prod.yml up -d --build --wait --wait-timeout 600 db backend
    docker compose -f infra/docker-compose.prod.yml logs --no-color backend
    docker compose -f infra/docker-compose.prod.yml exec -T db \
      psql -X -U app -d staffly -v ON_ERROR_STOP=1 -c \
      "SELECT installed_rank, version, description, success FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;"
    docker compose -f infra/docker-compose.prod.yml exec -T backend \
      curl --fail --silent --show-error http://127.0.0.1:8080/api/ready
    ```

11. Verify Flyway completed successfully through **119** for this release, no failed
    history entries, Hibernate schema validation passed, correct `prod` profile and
    readiness HTTP 200 (`ready`). A later release must update the expected version.
    Any failure: leave worker stopped, preserve logs/history and follow recovery.
12. Start one worker, verify startup, then restore frontend/proxy and controlled traffic:

    ```sh
    docker compose -f infra/docker-compose.prod.yml up -d --build backend-worker
    docker compose -f infra/docker-compose.prod.yml logs --no-color backend-worker
    docker compose -f infra/docker-compose.prod.yml up -d frontend caddy
    docker compose -f infra/docker-compose.prod.yml ps
    ```

### Readiness and ordering semantics

Both dev/prod have DB TCP `pg_isready` (avoids the image's temporary initialization
socket server), API `/api/ready` checked with curl included in the runtime image, and
worker dependencies on healthy DB AND API. API waits for DB; frontend/caddy wait for
healthy API, caddy also waits for frontend start. API readiness requires Spring
`ACCEPTING_TRAFFIC` after Flyway/context/runners and a live `SELECT 1`; it exposes no
DB details. Actuator is not needed. API Flyway stays enabled; worker Flyway stays
disabled and its web application type stays `none`; scheduling stays worker-only.

Healthchecks poll actual state, not elapsed sleeps. The API health budget is 30s
start period plus 60 failures at 5s intervals; adjust to measured rehearsal time.
Failed Flyway prevents ready API startup, so a new worker cannot start through a
normal `docker compose up`. Do not override API Flyway or readiness settings.
`depends_on` is a Compose startup gate, not continuous orchestration: it does not
stop an existing worker on API failure, protect manual `docker start`/`--no-deps`,
Docker daemon restarts, or provide exactly-once distributed job execution. Stop
worker explicitly before each migration and operate only one worker instance.
See [Compose ordering](https://docs.docker.com/compose/how-tos/startup-order/) and
[Spring availability](https://docs.spring.io/spring-boot/reference/features/spring-application.html).

## Compact production smoke

Use designated smoke accounts/restaurant with agreed cleanup through application
flows; no full 21-scenario lifecycle regression in production.

- API logs show `prod`, successful Flyway through V119 and no startup exceptions;
  `/api/ready` responds 200 internally and through the public route.
- Worker logs show `prod,worker`, no web server and no Flyway migration attempt.
  Inspect effective configuration (without printing secrets):
  `application-worker.yml` has `spring.flyway.enabled=false`; no deployment override.
- One worker container/process only. Temporarily enable Spring scheduling DEBUG
  logging during rehearsal/diagnosis to record six scheduled methods exactly once
  (five cron jobs plus PushDeliveryWorker if push is enabled); the API registers
  zero. Existing `SchedulingConfigTest` verifies these profile registrations.
  This proves registration, not exactly-once job delivery across failures.
- Observe a worker dispatch interval (push 5s if enabled, reminders 2min) and
  inspect logs for missing-column/relation, SQL, lock or other startup job errors.
  Observe hourly/daily jobs in rehearsal or their next scheduled window without
  manually replaying them in production just to force smoke coverage.
- Global configured CREATOR with no synthetic membership can open restaurant
  administration. Confirm membership remains absent with a read-only DB query.
- Authenticated `GET /api/restaurants/{id}/members` lists valid employees.
- Create one authorized invitation via impact then `/members/invite`; accept via
  `POST /api/invitations/{token}/accept` as the designated user. Confirm one active
  membership and expected position; remove smoke employment through approved UI.
- Preview one `POST /api/restaurants/{id}/members/{memberId}/position-change-impact`
  with `targetPositionId`; do not apply a production position change for this smoke.
- Read `GET /api/restaurants/{id}/training/folders` as an authorized manager.

## Rollback / recovery

Keep traffic and worker stopped on any failure. Capture Flyway logs/schema history
and establish which migrations committed. PostgreSQL normally rolls back a failed
transactional migration, but earlier successful migrations may already be committed.
Never run `flyway repair`, alter history or modify migration checksums to hide a failure.

A previous API image is not necessarily compatible after V115 drops role/avatar or
V119 invalidates invitations. There is no guaranteed database down migration. Use
an approved forward fix or restore a verified pre-migration backup with the matching
old images into an isolated/replacement database, validate it, then switch service
connections deliberately. Restore may lose all writes after backup; preserve and
reconcile those first. Do not overwrite the only production volume or delete it.
After recovery, repeat readiness and the relevant smoke before restoring traffic.
