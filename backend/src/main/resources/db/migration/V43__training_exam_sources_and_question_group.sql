ALTER TABLE training_question
    ADD COLUMN IF NOT EXISTS question_group VARCHAR(20);

UPDATE training_question
SET question_group = 'CERTIFICATION'
WHERE question_group IS NULL;

ALTER TABLE training_question
    ALTER COLUMN question_group SET NOT NULL;

ALTER TABLE training_question
    DROP CONSTRAINT IF EXISTS chk_training_question_group;

ALTER TABLE training_question
    ADD CONSTRAINT chk_training_question_group CHECK (question_group IN ('PRACTICE', 'CERTIFICATION'));

CREATE TABLE IF NOT EXISTS training_exam_source_folder (
    id BIGSERIAL PRIMARY KEY,
    exam_id BIGINT NOT NULL REFERENCES training_exam(id) ON DELETE CASCADE,
    folder_id BIGINT NOT NULL REFERENCES training_folder(id) ON DELETE CASCADE,
    pick_mode VARCHAR(20) NOT NULL CHECK (pick_mode IN ('ALL', 'RANDOM')),
    random_count INT,
    CONSTRAINT uq_training_exam_source_folder UNIQUE (exam_id, folder_id),
    CONSTRAINT chk_training_exam_source_folder_random CHECK (
        (pick_mode = 'ALL' AND random_count IS NULL) OR
        (pick_mode = 'RANDOM' AND random_count IS NOT NULL AND random_count > 0)
    )
);

CREATE TABLE IF NOT EXISTS training_exam_source_question (
    id BIGSERIAL PRIMARY KEY,
    exam_id BIGINT NOT NULL REFERENCES training_exam(id) ON DELETE CASCADE,
    question_id BIGINT NOT NULL REFERENCES training_question(id) ON DELETE CASCADE,
    CONSTRAINT uq_training_exam_source_question UNIQUE (exam_id, question_id)
);

INSERT INTO training_exam_source_folder (exam_id, folder_id, pick_mode, random_count)
SELECT exam_id, folder_id, 'ALL', NULL
FROM training_exam_scope
ON CONFLICT (exam_id, folder_id) DO NOTHING;

DROP TABLE IF EXISTS training_exam_scope;
