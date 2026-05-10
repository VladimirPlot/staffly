ALTER TABLE training_exam
    ADD COLUMN IF NOT EXISTS created_by_user_id BIGINT,
    ADD COLUMN IF NOT EXISTS owner_user_id BIGINT;

ALTER TABLE training_exam
    DROP CONSTRAINT IF EXISTS fk_training_exam_created_by_user;

ALTER TABLE training_exam
    ADD CONSTRAINT fk_training_exam_created_by_user
        FOREIGN KEY (created_by_user_id) REFERENCES users(id) ON DELETE SET NULL;

ALTER TABLE training_exam
    DROP CONSTRAINT IF EXISTS fk_training_exam_owner_user;

ALTER TABLE training_exam
    ADD CONSTRAINT fk_training_exam_owner_user
        FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_training_exam_created_by_user_id
    ON training_exam(created_by_user_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_owner_user_id
    ON training_exam(owner_user_id);