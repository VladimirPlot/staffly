-- V37__training_attempt_restaurant_and_snapshots.sql

ALTER TABLE training_exam_attempt
    ADD COLUMN IF NOT EXISTS restaurant_id BIGINT;

-- 1) основной источник restaurant_id — training_exam
UPDATE training_exam_attempt a
SET restaurant_id = e.restaurant_id
FROM training_exam e
WHERE a.exam_id = e.id
  AND a.restaurant_id IS NULL;

-- 2) добивка оставшихся: берём самый ранний restaurant_member для user_id
WITH rm AS (
    SELECT
        a.id AS attempt_id,
        (
            SELECT m.restaurant_id
            FROM restaurant_member m
            WHERE m.user_id = a.user_id
            ORDER BY m.created_at ASC NULLS LAST, m.id ASC
            LIMIT 1
        ) AS restaurant_id
    FROM training_exam_attempt a
    WHERE a.restaurant_id IS NULL
)
UPDATE training_exam_attempt a
SET restaurant_id = rm.restaurant_id
FROM rm
WHERE a.id = rm.attempt_id
  AND rm.restaurant_id IS NOT NULL;

-- 3) жёсткая проверка: иначе FK/NOT NULL нельзя
DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM training_exam_attempt WHERE restaurant_id IS NULL) THEN
        RAISE EXCEPTION 'Cannot backfill training_exam_attempt.restaurant_id for all rows';
    END IF;
END $$;

-- 4) теперь можно зафиксировать целостность
ALTER TABLE training_exam_attempt
    DROP CONSTRAINT IF EXISTS training_exam_attempt_restaurant_id_fkey;

ALTER TABLE training_exam_attempt
    ADD CONSTRAINT training_exam_attempt_restaurant_id_fkey
        FOREIGN KEY (restaurant_id) REFERENCES restaurants(id) ON DELETE CASCADE;

ALTER TABLE training_exam_attempt
    ALTER COLUMN restaurant_id SET NOT NULL;

-- 5) snapshot-колонки (DEFAULT нужны, чтобы мгновенно прошёл NOT NULL на существующих строках)
ALTER TABLE training_exam_attempt
    ADD COLUMN IF NOT EXISTS pass_percent_snapshot INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS title_snapshot VARCHAR(150) NOT NULL DEFAULT '',
    ADD COLUMN IF NOT EXISTS question_count_snapshot INT NOT NULL DEFAULT 1,
    ADD COLUMN IF NOT EXISTS time_limit_sec_snapshot INT;

-- 6) заполнить снапшоты из текущего состояния экзамена
UPDATE training_exam_attempt a
SET pass_percent_snapshot   = e.pass_percent,
    title_snapshot          = e.title,
    question_count_snapshot = e.question_count,
    time_limit_sec_snapshot = e.time_limit_sec
FROM training_exam e
WHERE a.exam_id = e.id;

-- 7) индексы
CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_restaurant_user
    ON training_exam_attempt(restaurant_id, user_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_restaurant_exam
    ON training_exam_attempt(restaurant_id, exam_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_attempt_restaurant_started_at
    ON training_exam_attempt(restaurant_id, started_at);