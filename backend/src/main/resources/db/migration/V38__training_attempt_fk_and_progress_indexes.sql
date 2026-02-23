ALTER TABLE training_exam_attempt
    DROP CONSTRAINT IF EXISTS training_exam_attempt_restaurant_id_fkey;

ALTER TABLE training_exam_attempt
    ADD CONSTRAINT training_exam_attempt_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_progress_lookup
    ON training_exam_attempt(restaurant_id, user_id, exam_id, exam_version, passed);

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_user_finished_at
    ON training_exam_attempt(restaurant_id, user_id, finished_at DESC);