-- Employee Lifecycle Phase 1. Run docs/employee-lifecycle-phase1-reconnaissance.sql first.
-- The migration intentionally refuses ambiguous data instead of silently changing shared Position levels.
DO $$
DECLARE inconsistent_count bigint;
BEGIN
    SELECT count(*) INTO inconsistent_count
    FROM restaurant_member m
    LEFT JOIN position p ON p.id = m.position_id
    WHERE m.position_id IS NULL
       OR p.id IS NULL
       OR p.restaurant_id IS DISTINCT FROM m.restaurant_id
       OR p.level IS DISTINCT FROM m.role;
    IF inconsistent_count > 0 THEN
        RAISE EXCEPTION 'Employee lifecycle reconciliation required for % membership(s): position is missing, belongs to another restaurant, or its level differs from member role. Run the reconnaissance script and resolve each row.', inconsistent_count;
    END IF;
END $$;

ALTER TABLE restaurant_member RENAME COLUMN created_at TO started_at;
ALTER TABLE restaurant_member ADD COLUMN ended_at TIMESTAMPTZ;
ALTER TABLE restaurant_member ADD COLUMN ended_by_user_id BIGINT REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE restaurant_member ALTER COLUMN position_id SET NOT NULL;
ALTER TABLE restaurant_member DROP CONSTRAINT IF EXISTS uq_member_user_restaurant;
DROP INDEX IF EXISTS uq_member_user_restaurant;
CREATE UNIQUE INDEX uq_restaurant_member_active_user
    ON restaurant_member(user_id, restaurant_id) WHERE ended_at IS NULL;
CREATE INDEX idx_restaurant_member_active_restaurant
    ON restaurant_member(restaurant_id) WHERE ended_at IS NULL;
ALTER TABLE restaurant_member DROP CONSTRAINT IF EXISTS chk_member_role;
ALTER TABLE restaurant_member DROP COLUMN role;
ALTER TABLE restaurant_member DROP COLUMN IF EXISTS avatar_url;

ALTER TABLE position_change_audit ADD COLUMN old_position_name VARCHAR(100);
ALTER TABLE position_change_audit ADD COLUMN new_position_name VARCHAR(100);
ALTER TABLE position_change_audit ADD COLUMN old_position_level VARCHAR(20);
ALTER TABLE position_change_audit ADD COLUMN new_position_level VARCHAR(20);
UPDATE position_change_audit a SET
    old_position_name = op.name,
    new_position_name = np.name,
    old_position_level = op.level,
    new_position_level = np.level
FROM position op, position np
WHERE op.id = a.old_position_id AND np.id = a.new_position_id;
DO $$
DECLARE unresolved_count bigint;
BEGIN
    SELECT count(*) INTO unresolved_count
    FROM position_change_audit
    WHERE old_position_name IS NULL OR new_position_name IS NULL
       OR old_position_level IS NULL OR new_position_level IS NULL;
    IF unresolved_count > 0 THEN
        RAISE EXCEPTION 'Cannot reconstruct Position snapshots for % position_change_audit row(s). Reconcile the referenced positions before applying V115.', unresolved_count;
    END IF;
END $$;
ALTER TABLE position_change_audit ALTER COLUMN old_position_name SET NOT NULL;
ALTER TABLE position_change_audit ALTER COLUMN new_position_name SET NOT NULL;
ALTER TABLE position_change_audit ALTER COLUMN old_position_level SET NOT NULL;
ALTER TABLE position_change_audit ALTER COLUMN new_position_level SET NOT NULL;
