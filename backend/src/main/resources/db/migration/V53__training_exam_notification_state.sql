CREATE TABLE IF NOT EXISTS training_exam_notification_state (
    exam_id BIGINT PRIMARY KEY REFERENCES training_exam(id) ON DELETE CASCADE,
    last_completed_milestone INT NOT NULL DEFAULT 0,
    updated_at TIMESTAMP NOT NULL
);