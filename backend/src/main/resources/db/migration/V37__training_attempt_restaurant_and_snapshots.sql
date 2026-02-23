ALTER TABLE training_exam_attempt
    ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;

UPDATE training_exam_attempt a
SET restaurant_id = e.restaurant_id
FROM training_exam e
WHERE a.exam_id = e.id
  AND a.restaurant_id IS NULL;

UPDATE training_exam_attempt a
SET restaurant_id = rm.restaurant_id
FROM LATERAL (
    SELECT m.restaurant_id
    FROM restaurant_member m
    WHERE m.user_id = a.user_id
    ORDER BY m.created_at ASC NULLS LAST, m.id ASC
    LIMIT 1
) rm
WHERE a.restaurant_id IS NULL;

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM training_exam_attempt WHERE restaurant_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot backfill training_exam_attempt.restaurant_id for all rows';
    END IF;
END $$;

ALTER TABLE training_exam_attempt
    ADD CONSTRAINT training_exam_attempt_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE training_exam_attempt
    ALTER COLUMN restaurant_id SET NOT NULL;

ALTER TABLE training_exam_attempt
    ADD COLUMN IF NOT EXISTS pass_percent_snapshot INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS title_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS question_count_snapshot INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS time_limit_sec_snapshot INT;

UPDATE training_exam_attempt a
SET pass_percent_snapshot = e.pass_percent,
    title_snapshot = e.title,
    question_count_snapshot = e.question_count,
    time_limit_sec_snapshot = e.time_limit_sec
FROM training_exam e
WHERE a.exam_id = e.id;

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_restaurant_user
    ON training_exam_attempt(restaurant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_restaurant_exam
    ON training_exam_attempt(restaurant_id, exam_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_restaurant_started_at
    ON training_exam_attempt(restaurant_id, started_at);