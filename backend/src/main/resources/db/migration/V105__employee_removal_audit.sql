CREATE TABLE employee_removal_audit (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    actor_user_id BIGINT NOT NULL REFERENCES users(id),
    member_id BIGINT NOT NULL,
    previous_position_id BIGINT,
    occurred_at TIMESTAMPTZ NOT NULL,
    affected_schedule_ids TEXT NOT NULL,
    removed_participation_count INTEGER NOT NULL,
    removed_submission_count INTEGER NOT NULL,
    invalidated_preference_draft_count INTEGER NOT NULL,
    historical_published_row_count INTEGER NOT NULL,
    cancelled_future_shift_count INTEGER NOT NULL
);

CREATE INDEX idx_employee_removal_audit_member
    ON employee_removal_audit(member_id, occurred_at DESC);
