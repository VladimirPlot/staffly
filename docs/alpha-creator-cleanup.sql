-- Staffly alpha, V114 only. Default: rehearsal + ROLLBACK.
-- Execute with psql -X -v ON_ERROR_STOP=1; use -v apply_cleanup=1 to commit.
-- Requires stopped API/worker, a backup, and no external writers.
\set ON_ERROR_STOP on
\if :{?apply_cleanup}
\else
\set apply_cleanup 0
\endif
BEGIN;
SET LOCAL search_path = public, pg_catalog;
SET LOCAL lock_timeout = '10s';
LOCK TABLE restaurant_member, task, task_comment, schedule,
    inbox_recipients, checklist_item_history IN SHARE ROW EXCLUSIVE MODE;

DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM flyway_schema_history WHERE version = '114' AND success)
       OR EXISTS (SELECT 1 FROM flyway_schema_history WHERE version::numeric >= 115 AND success) THEN
        RAISE EXCEPTION 'Expected V114 before V115; nothing changed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM restaurants WHERE id = 4 AND upper(name) = 'ЮГ22')
       OR NOT EXISTS (SELECT 1 FROM users WHERE id = 1 AND phone = '+79999999999') THEN
        RAISE EXCEPTION 'Restaurant/creator identity mismatch';
    END IF;
    IF (SELECT count(*) FROM restaurant_member WHERE id IN (2,4,26,38,40)
          AND user_id = 1 AND position_id IS NULL AND role = 'ADMIN') <> 5
       OR EXISTS (SELECT 1 FROM restaurant_member WHERE user_id = 1 AND id NOT IN (2,4,26,38,40)) THEN
        RAISE EXCEPTION 'Creator membership set changed; review again';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM restaurant_member m JOIN position p ON p.id = m.position_id
                   WHERE m.id = 3 AND m.user_id = 2 AND m.restaurant_id = 2
                     AND p.restaurant_id = 2 AND p.level = 'ADMIN' AND m.role = 'ADMIN')
       OR NOT EXISTS (SELECT 1 FROM schedule WHERE id = 13 AND restaurant_id = 2
                       AND owner_user_id = 1 AND owner_member_id = 2)
       OR EXISTS (SELECT 1 FROM schedule WHERE owner_member_id IN (2,4,26,38,40) AND id <> 13) THEN
        RAISE EXCEPTION 'Schedule owner transfer no longer matches inspected data';
    END IF;
    IF (SELECT count(*) FROM task WHERE id IN (1,2,3,4,5,7)
         AND restaurant_id = CASE WHEN id = 4 THEN 7 ELSE 4 END) <> 6 THEN
        RAISE EXCEPTION 'Expected six reviewed test tasks';
    END IF;
END $$;

-- Capture complete rows, including IDs/content, rather than only row counts.
CREATE TEMP TABLE protected_snapshot (table_name text PRIMARY KEY, rows jsonb) ON COMMIT DROP;
DO $$
DECLARE t text; q text; snapshot jsonb;
BEGIN
    FOREACH t IN ARRAY ARRAY['restaurants','users','position','restaurant_member',
        'schedule','schedule_row','schedule_cell','training_folder','training_knowledge_item']
    LOOP
        q := format('SELECT coalesce(jsonb_agg(j ORDER BY j->>''id''), ''[]''::jsonb) FROM (SELECT to_jsonb(x) AS j FROM %I x', t);
        IF t = 'restaurant_member' THEN
            q := q || ' WHERE id NOT IN (2,4,26,38,40)';
        ELSIF t = 'schedule' THEN
            q := 'SELECT coalesce(jsonb_agg(j ORDER BY j->>''id''), ''[]''::jsonb) FROM (SELECT CASE WHEN id=13 THEN to_jsonb(x) - ''owner_user_id'' - ''owner_member_id'' ELSE to_jsonb(x) END AS j FROM schedule x';
        END IF;
        EXECUTE q || ') protected' INTO snapshot;
        INSERT INTO protected_snapshot VALUES (t, snapshot);
    END LOOP;
END $$;

-- Abort if any additional membership reference appeared, including logical references.
DO $$
DECLARE c record; n bigint;
BEGIN
    FOR c IN SELECT table_schema, table_name, column_name FROM information_schema.columns
        WHERE table_schema = 'public' AND column_name LIKE '%member_id'
          AND data_type IN ('bigint','integer','smallint')
    LOOP
        EXECUTE format('SELECT count(*) FROM %I.%I WHERE %I IN (2,4,26,38,40)',
            c.table_schema, c.table_name, c.column_name) INTO n;
        IF n > 0 AND NOT (
            (c.table_name = 'schedule' AND c.column_name = 'owner_member_id') OR
            (c.table_name = 'checklist_item_history' AND c.column_name = 'done_by_member_id') OR
            (c.table_name = 'inbox_recipients' AND c.column_name = 'member_id')) THEN
            RAISE EXCEPTION 'Unexpected dependency %.%: % rows', c.table_name, c.column_name, n;
        END IF;
    END LOOP;
    -- Check FKs even when a referencing column has a nonstandard name.
    FOR c IN SELECT conrelid::regclass AS tbl, a.attname AS col
        FROM pg_constraint fk JOIN pg_attribute a
          ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]
        WHERE fk.contype = 'f' AND fk.confrelid = 'restaurant_member'::regclass
    LOOP
        EXECUTE format('SELECT count(*) FROM %s WHERE %I IN (2,4,26,38,40)', c.tbl, c.col) INTO n;
        IF n > 0 AND NOT (
            (c.tbl::text = 'schedule' AND c.col = 'owner_member_id') OR
            (c.tbl::text = 'checklist_item_history' AND c.col = 'done_by_member_id') OR
            (c.tbl::text = 'inbox_recipients' AND c.col = 'member_id')) THEN
            RAISE EXCEPTION 'Unexpected FK dependency %.%: % rows', c.tbl, c.col, n;
        END IF;
    END LOOP;
    FOR c IN SELECT conrelid::regclass AS tbl, a.attname AS col
        FROM pg_constraint fk JOIN pg_attribute a
          ON a.attrelid = fk.conrelid AND a.attnum = fk.conkey[1]
        WHERE fk.contype = 'f' AND fk.confrelid = 'task'::regclass
    LOOP
        EXECUTE format('SELECT count(*) FROM %s WHERE %I IN (1,2,3,4,5,7)', c.tbl, c.col) INTO n;
        IF n > 0 AND c.tbl::text <> 'task_comment' THEN
            RAISE EXCEPTION 'Unexpected test-task dependency %.%: % rows', c.tbl, c.col, n;
        END IF;
    END LOOP;
END $$;

UPDATE schedule SET owner_user_id = 2, owner_member_id = 3 WHERE id = 13;
-- Retain checklist history, names, times and contents; remove only synthetic identity link.
UPDATE checklist_item_history SET done_by_member_id = NULL
WHERE done_by_member_id IN (2,4,26,38,40);
DELETE FROM inbox_recipients WHERE member_id IN (2,4,26,38,40);
-- Explicit comment deletion; both tasks and comments were test data.
DELETE FROM task_comment WHERE task_id IN (1,2,3,4,5,7);
DELETE FROM task WHERE id IN (1,2,3,4,5,7);
DELETE FROM restaurant_member WHERE id IN (2,4,26,38,40);

DO $$
DECLARE r record; q text; snapshot jsonb;
BEGIN
    FOR r IN SELECT * FROM protected_snapshot LOOP
        q := format('SELECT coalesce(jsonb_agg(j ORDER BY j->>''id''), ''[]''::jsonb) FROM (SELECT to_jsonb(x) AS j FROM %I x', r.table_name);
        IF r.table_name = 'restaurant_member' THEN
            q := q || ' WHERE id NOT IN (2,4,26,38,40)';
        ELSIF r.table_name = 'schedule' THEN
            q := 'SELECT coalesce(jsonb_agg(j ORDER BY j->>''id''), ''[]''::jsonb) FROM (SELECT CASE WHEN id=13 THEN to_jsonb(x) - ''owner_user_id'' - ''owner_member_id'' ELSE to_jsonb(x) END AS j FROM schedule x';
        END IF;
        EXECUTE q || ') protected' INTO snapshot;
        IF snapshot IS DISTINCT FROM r.rows THEN
            RAISE EXCEPTION 'Protected data changed in %; rolling back', r.table_name;
        END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM restaurant_member m LEFT JOIN position p ON p.id = m.position_id
        WHERE m.position_id IS NULL OR p.id IS NULL
          OR p.restaurant_id IS DISTINCT FROM m.restaurant_id OR p.level IS DISTINCT FROM m.role)
       OR EXISTS (SELECT 1 FROM restaurant_member GROUP BY user_id,restaurant_id HAVING count(*) > 1) THEN
        RAISE EXCEPTION 'V115 membership blockers remain';
    END IF;
    IF EXISTS (SELECT 1 FROM position_change_audit a
        LEFT JOIN position op ON op.id = a.old_position_id LEFT JOIN position np ON np.id = a.new_position_id
        WHERE op.id IS NULL OR np.id IS NULL OR op.name IS NULL OR np.name IS NULL
          OR op.level IS NULL OR np.level IS NULL) THEN
        RAISE EXCEPTION 'V115 audit blockers remain';
    END IF;
    IF EXISTS (
        WITH people AS (
            SELECT id,restaurant_id,created_at,assigned_user_id AS user_id FROM task WHERE assigned_user_id IS NOT NULL
            UNION ALL SELECT id,restaurant_id,created_at,created_by_id FROM task WHERE created_by_id IS NOT NULL
        ) SELECT 1 FROM people t WHERE
            (SELECT count(*) FROM restaurant_member m WHERE m.user_id = t.user_id
             AND m.restaurant_id = t.restaurant_id AND m.created_at <= t.created_at) <> 1
    ) THEN
        RAISE EXCEPTION 'V117 task blockers remain';
    END IF;
    RAISE NOTICE 'Checks passed: protected data identical; V115/V117 data gates clear';
END $$;

SELECT id, restaurant_id, owner_user_id, owner_member_id FROM schedule WHERE id = 13;
\if :apply_cleanup
COMMIT;
\echo Cleanup committed. Run the full production preflight before starting services.
\else
ROLLBACK;
\echo Rehearsal finished: ALL changes rolled back. Use apply_cleanup=1 to apply.
\endif
