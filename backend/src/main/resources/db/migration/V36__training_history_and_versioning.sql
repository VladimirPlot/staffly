ALTER TABLE training_exam_attempt_question
    DROP CONSTRAINT IF EXISTS training_exam_attempt_question_question_id_fkey;

ALTER TABLE training_exam_attempt_question
    ALTER COLUMN question_id DROP NOT NULL;

ALTER TABLE training_exam_attempt_question
    ADD CONSTRAINT training_exam_attempt_question_question_id_fkey
        FOREIGN KEY (question_id) REFERENCES training_question(id) ON DELETE SET NULL;

ALTER TABLE training_exam_attempt
    DROP CONSTRAINT IF EXISTS training_exam_attempt_exam_id_fkey;

ALTER TABLE training_exam_attempt
    ALTER COLUMN exam_id DROP NOT NULL;

ALTER TABLE training_exam_attempt
    ADD CONSTRAINT training_exam_attempt_exam_id_fkey
        FOREIGN KEY (exam_id) REFERENCES training_exam(id) ON DELETE SET NULL;

ALTER TABLE training_exam
    ADD COLUMN IF NOT EXISTS version INT NOT NULL DEFAULT 1;

ALTER TABLE training_exam_attempt
    ADD COLUMN IF NOT EXISTS exam_version INT NOT NULL DEFAULT 1;

UPDATE training_exam_attempt
SET exam_version = 1
WHERE exam_version IS NULL;

CREATE INDEX IF NOT EXISTS idx_training_folder_restaurant_parent
    ON training_folder(restaurant_id, parent_id);

CREATE INDEX IF NOT EXISTS idx_training_knowledge_item_restaurant_folder
    ON training_knowledge_item(restaurant_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_training_question_restaurant_folder
    ON training_question(restaurant_id, folder_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_scope_folder
    ON training_exam_scope(folder_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_scope_exam
    ON training_exam_scope(exam_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_user_exam
    ON training_exam_attempt(user_id, exam_id);
