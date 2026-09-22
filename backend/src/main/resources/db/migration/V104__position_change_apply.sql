ALTER TABLE schedule_row ADD COLUMN historical BOOLEAN NOT NULL DEFAULT FALSE;
UPDATE schedule_row r SET historical = TRUE
FROM schedule s
WHERE r.schedule_id = s.id AND s.status = 'PUBLISHED'
  AND NOT EXISTS (
      SELECT 1 FROM schedule_participation p
      WHERE p.schedule_id = r.schedule_id AND p.member_id = r.member_id
  );

CREATE TABLE position_change_audit (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    actor_user_id BIGINT NOT NULL REFERENCES users(id),
    member_id BIGINT NOT NULL,
    old_position_id BIGINT NOT NULL,
    new_position_id BIGINT NOT NULL,
    occurred_at TIMESTAMPTZ NOT NULL,
    details TEXT NOT NULL
);
CREATE INDEX idx_position_change_audit_member ON position_change_audit(member_id, occurred_at DESC);
