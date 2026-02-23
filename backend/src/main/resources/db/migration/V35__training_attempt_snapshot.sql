ALTER TABLE training_exam_attempt_question
    ADD COLUMN question_snapshot_json TEXT,
    ADD COLUMN correct_key_json TEXT;

UPDATE training_exam_attempt_question
SET question_snapshot_json = '{}',
    correct_key_json = '{}'
WHERE question_snapshot_json IS NULL OR correct_key_json IS NULL;

ALTER TABLE training_exam_attempt_question
    ALTER COLUMN question_snapshot_json SET NOT NULL,
    ALTER COLUMN correct_key_json SET NOT NULL;

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_question_attempt_id
    ON training_exam_attempt_question(attempt_id);
