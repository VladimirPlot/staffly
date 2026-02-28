ALTER TABLE training_question
    ADD COLUMN IF NOT EXISTS title VARCHAR(150);

UPDATE training_question
SET title = CASE
    WHEN length(trim(prompt)) > 0 THEN left(trim(prompt), 150)
    ELSE 'Вопрос #' || id
END
WHERE title IS NULL OR length(trim(title)) = 0;

ALTER TABLE training_question
    ALTER COLUMN title SET NOT NULL;

CREATE TABLE IF NOT EXISTS training_question_blank (
    id BIGSERIAL PRIMARY KEY,
    question_id BIGINT NOT NULL REFERENCES training_question(id) ON DELETE CASCADE,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_training_question_blank_question
    ON training_question_blank(question_id);

CREATE TABLE IF NOT EXISTS training_question_blank_option (
    id BIGSERIAL PRIMARY KEY,
    blank_id BIGINT NOT NULL REFERENCES training_question_blank(id) ON DELETE CASCADE,
    text TEXT NOT NULL,
    is_correct BOOLEAN NOT NULL,
    sort_order INT NOT NULL DEFAULT 0
);

CREATE INDEX IF NOT EXISTS idx_training_question_blank_option_blank
    ON training_question_blank_option(blank_id);