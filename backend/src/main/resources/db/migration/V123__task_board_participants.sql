ALTER TABLE task ADD COLUMN completion_mode varchar(16) NOT NULL DEFAULT 'ANY';
ALTER TABLE task ADD COLUMN audience varchar(16) NOT NULL DEFAULT 'NONE';
ALTER TABLE task ADD COLUMN definition_version bigint NOT NULL DEFAULT 0;
ALTER TABLE task ADD COLUMN activity_version bigint NOT NULL DEFAULT 0;
ALTER TABLE task ADD COLUMN completed_by_member_id bigint REFERENCES restaurant_member(id);
ALTER TABLE task ADD COLUMN completion_reason varchar(40);
ALTER TABLE task ADD COLUMN overdue_notified_for date;
UPDATE task SET audience = CASE WHEN assigned_to_all THEN 'ALL' WHEN assigned_position_id IS NOT NULL THEN 'POSITIONS' WHEN assigned_member_id IS NOT NULL THEN 'MEMBERS' ELSE 'NONE' END;
CREATE TABLE task_position (task_id bigint NOT NULL REFERENCES task(id) ON DELETE CASCADE, position_id bigint NOT NULL REFERENCES position(id), PRIMARY KEY(task_id, position_id));
INSERT INTO task_position SELECT id, assigned_position_id FROM task WHERE assigned_position_id IS NOT NULL;
CREATE TABLE task_participant (
 id bigserial PRIMARY KEY, task_id bigint NOT NULL REFERENCES task(id) ON DELETE CASCADE,
 member_id bigint NOT NULL REFERENCES restaurant_member(id), active boolean NOT NULL DEFAULT true,
 completed_at timestamptz, joined_at timestamptz NOT NULL, left_at timestamptz,
 UNIQUE(task_id, member_id)
);
INSERT INTO task_participant(task_id, member_id, active, joined_at)
 SELECT t.id, t.assigned_member_id, m.ended_at IS NULL, t.created_at AT TIME ZONE 'UTC' FROM task t JOIN restaurant_member m ON m.id=t.assigned_member_id;
INSERT INTO task_participant(task_id, member_id, active, joined_at)
 SELECT t.id, m.id, true, t.created_at AT TIME ZONE 'UTC' FROM task t JOIN restaurant_member m ON m.restaurant_id=t.restaurant_id AND m.ended_at IS NULL
 WHERE t.assigned_to_all OR t.assigned_position_id=m.position_id
 ON CONFLICT(task_id, member_id) DO NOTHING;
CREATE INDEX idx_task_participant_member ON task_participant(member_id, task_id);
CREATE TABLE task_event (
 id bigserial PRIMARY KEY, task_id bigint NOT NULL REFERENCES task(id) ON DELETE CASCADE,
 actor_name varchar(255) NOT NULL, text text NOT NULL, created_at timestamptz NOT NULL
);
ALTER TABLE invitation ADD COLUMN task_decisions jsonb NOT NULL DEFAULT '[]'::jsonb;
