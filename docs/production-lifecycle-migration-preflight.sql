-- READ ONLY. Run with psql -X -v ON_ERROR_STOP=1 against a V114 database.
-- Reports do not repair data. Every non-zero blocker must be reconciled explicitly.
-- Replace the creator-phone placeholder below with ALL effective app.creator.phones.
-- Run on the primary with writers stopped; task timestamp comparisons use the
-- migration connection's TimeZone (do not change it just for this report).
BEGIN ISOLATION LEVEL REPEATABLE READ READ ONLY;
SET LOCAL search_path = public, pg_catalog;

DO $$ BEGIN
    IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version = '114' AND success)
       OR EXISTS (SELECT 1 FROM flyway_schema_history WHERE version::numeric >= 115 AND success) THEN
        RAISE EXCEPTION 'This report requires the V114 schema before V115. Use the restored V114 rehearsal copy; after V115 use phase3 task reconnaissance instead.';
    END IF;
END $$;

SELECT current_database() AS database, current_setting('TimeZone') AS timezone,
       current_setting('transaction_read_only') AS read_only;
SELECT installed_rank, version, description, success
FROM flyway_schema_history ORDER BY installed_rank DESC LIMIT 10;

-- V115 blocker summary. Categories may overlap; counts must ALL be zero.
SELECT 'member_null_position' AS blocker, count(*) AS anomaly_count
FROM restaurant_member WHERE position_id IS NULL
UNION ALL
SELECT 'member_missing_position', count(*)
FROM restaurant_member m LEFT JOIN position p ON p.id = m.position_id
WHERE m.position_id IS NOT NULL AND p.id IS NULL
UNION ALL
SELECT 'member_cross_restaurant_position', count(*)
FROM restaurant_member m JOIN position p ON p.id = m.position_id
WHERE p.restaurant_id IS DISTINCT FROM m.restaurant_id
UNION ALL
SELECT 'member_role_level_mismatch', count(*)
FROM restaurant_member m JOIN position p ON p.id = m.position_id
WHERE p.level IS DISTINCT FROM m.role
UNION ALL
SELECT 'duplicate_membership_groups_all_become_active_in_V115', count(*)
FROM (SELECT user_id, restaurant_id FROM restaurant_member
      GROUP BY user_id, restaurant_id HAVING count(*) > 1) duplicates
UNION ALL
SELECT 'audit_unreconstructable_position_snapshots', count(*)
FROM position_change_audit a
LEFT JOIN position op ON op.id = a.old_position_id
LEFT JOIN position np ON np.id = a.new_position_id
WHERE op.id IS NULL OR np.id IS NULL OR op.name IS NULL OR np.name IS NULL
   OR op.level IS NULL OR np.level IS NULL;

-- Details: mirrors the first V115 fail-fast predicate exactly.
SELECT m.id, m.user_id, m.restaurant_id, m.created_at, m.role, m.position_id,
       p.restaurant_id AS position_restaurant_id, p.name, p.level,
       m.position_id IS NULL AS null_position,
       (m.position_id IS NOT NULL AND p.id IS NULL) AS missing_position,
       p.restaurant_id IS DISTINCT FROM m.restaurant_id AS restaurant_mismatch,
       p.level IS DISTINCT FROM m.role AS role_level_mismatch
FROM restaurant_member m LEFT JOIN position p ON p.id = m.position_id
WHERE m.position_id IS NULL OR p.id IS NULL
   OR p.restaurant_id IS DISTINCT FROM m.restaurant_id
   OR p.level IS DISTINCT FROM m.role
ORDER BY m.restaurant_id, m.id;

SELECT user_id, restaurant_id, count(*) AS memberships, array_agg(id ORDER BY id) AS member_ids
FROM restaurant_member GROUP BY user_id, restaurant_id HAVING count(*) > 1
ORDER BY restaurant_id, user_id;

-- V104 intentionally has no old/new Position FK. Missing references are possible.
-- Both joins must succeed together for V115's UPDATE to populate any snapshots.
SELECT a.id, a.restaurant_id, a.member_id, a.old_position_id, a.new_position_id,
       op.name AS old_name, op.level AS old_level, np.name AS new_name, np.level AS new_level
FROM position_change_audit a
LEFT JOIN position op ON op.id = a.old_position_id
LEFT JOIN position np ON np.id = a.new_position_id
WHERE op.id IS NULL OR np.id IS NULL OR op.name IS NULL OR np.name IS NULL
   OR op.level IS NULL OR np.level IS NULL
ORDER BY a.id;

-- REVIEW ONLY: not a V115-enforced audit invariant, but suspicious history.
SELECT a.id, a.restaurant_id, op.restaurant_id AS old_restaurant_id,
       np.restaurant_id AS new_restaurant_id
FROM position_change_audit a JOIN position op ON op.id = a.old_position_id
JOIN position np ON np.id = a.new_position_id
WHERE op.restaurant_id IS DISTINCT FROM a.restaurant_id
   OR np.restaurant_id IS DISTINCT FROM a.restaurant_id ORDER BY a.id;

-- V117 blockers projected BEFORE V115: created_at becomes started_at and
-- every existing membership gets ended_at=NULL. Includes ALL tasks, even deleted
-- or completed ones; V117 requires every non-null author/assignee to resolve.
WITH task_people AS (
    SELECT id AS task_id, restaurant_id, created_at, 'ASSIGNEE' AS relation, assigned_user_id AS user_id
    FROM task WHERE assigned_user_id IS NOT NULL
    UNION ALL
    SELECT id, restaurant_id, created_at, 'SETTER', created_by_id
    FROM task WHERE created_by_id IS NOT NULL
), candidates AS (
    SELECT t.*, count(m.id) AS period_count, array_agg(m.id) FILTER (WHERE m.id IS NOT NULL) AS member_ids
    FROM task_people t LEFT JOIN restaurant_member m
      ON m.restaurant_id = t.restaurant_id AND m.user_id = t.user_id AND m.created_at <= t.created_at
    GROUP BY t.task_id, t.restaurant_id, t.created_at, t.relation, t.user_id
)
SELECT *, count(*) OVER () AS total_v117_blockers FROM candidates
WHERE period_count <> 1 ORDER BY task_id, relation;

-- Detection only. GlobalCreatorPolicy uses configured phones, not a DB CREATOR
-- role or email. Every membership of a configured creator deserves review;
-- invalid/null Position semantics makes it a likely legacy synthetic candidate.
WITH configured_creator_phones(phone) AS (VALUES ('<replace-with-deployed-creator-phone>'))
SELECT m.id, m.user_id, m.restaurant_id, m.created_at, m.role, m.position_id,
       u.phone, u.email, p.name, p.level,
       (m.position_id IS NULL OR p.id IS NULL
        OR p.restaurant_id IS DISTINCT FROM m.restaurant_id
        OR p.level IS DISTINCT FROM m.role) AS likely_legacy_synthetic
FROM restaurant_member m JOIN users u ON u.id = m.user_id
JOIN configured_creator_phones c ON c.phone = u.phone
LEFT JOIN position p ON p.id = m.position_id ORDER BY m.restaurant_id, m.id;

-- Review inbound FKs BEFORE considering any manual removal; CASCADE can erase
-- business history. Also inspect logical references without FKs (audits, tasks).
SELECT conrelid::regclass AS referencing_table, conname,
       pg_get_constraintdef(oid) AS constraint_definition
FROM pg_constraint WHERE contype = 'f' AND confrelid = 'restaurant_member'::regclass
ORDER BY conrelid::regclass::text, conname;

-- V119 intentionally invalidates/expires ALL pending legacy plans. Inventory
-- impact for operator review; this count need not be zero after approval.
SELECT status, count(*) AS invitations FROM invitation GROUP BY status ORDER BY status;
SELECT id, restaurant_id, expires_at,
       CASE WHEN expires_at <= now() THEN 'EXPIRED' ELSE 'INVALIDATED' END AS v119_status
FROM invitation WHERE status = 'PENDING' ORDER BY restaurant_id, id;

ROLLBACK;
