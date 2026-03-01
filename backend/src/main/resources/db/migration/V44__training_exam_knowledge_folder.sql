-- 1) Колонка (пока без FK, чтобы спокойно сделать backfill)
ALTER TABLE training_exam
    ADD COLUMN IF NOT EXISTS knowledge_folder_id BIGINT;

-- 2) CERTIFICATION всегда без knowledge_folder_id
UPDATE training_exam
SET knowledge_folder_id = NULL
WHERE mode = 'CERTIFICATION';

-- 3) Если у ресторана есть PRACTICE экзамены, но нет ни одной KNOWLEDGE папки — создаём корневую
INSERT INTO training_folder (restaurant_id, parent_id, name, description, type, sort_order, is_active)
SELECT
    e.restaurant_id,
    NULL,
    'Учебные тесты',
    'Создано автоматически миграцией V44',
    'KNOWLEDGE',
    0,
    TRUE
FROM (
    SELECT DISTINCT restaurant_id
    FROM training_exam
    WHERE mode = 'PRACTICE'
) e
WHERE NOT EXISTS (
    SELECT 1
    FROM training_folder f
    WHERE f.restaurant_id = e.restaurant_id
      AND f.type = 'KNOWLEDGE'
);

-- 4) Backfill для PRACTICE: проставляем любую существующую KNOWLEDGE папку (приоритет корневых)
UPDATE training_exam ex
SET knowledge_folder_id = (
    SELECT f.id
    FROM training_folder f
    WHERE f.restaurant_id = ex.restaurant_id
      AND f.type = 'KNOWLEDGE'
    ORDER BY (f.parent_id IS NULL) DESC, f.sort_order ASC, f.id ASC
    LIMIT 1
)
WHERE ex.mode = 'PRACTICE'
  AND ex.knowledge_folder_id IS NULL;

-- 5) Жёсткая проверка: после backfill не должно остаться PRACTICE с NULL
DO $$
BEGIN
    IF EXISTS (
        SELECT 1
        FROM training_exam
        WHERE mode = 'PRACTICE'
          AND knowledge_folder_id IS NULL
    ) THEN
        RAISE EXCEPTION 'V44 backfill failed: some PRACTICE exams still have NULL knowledge_folder_id';
    END IF;
END $$;

-- 6) FK (сначала NOT VALID, потом VALIDATE)
ALTER TABLE training_exam
    DROP CONSTRAINT IF EXISTS fk_training_exam_knowledge_folder;

ALTER TABLE training_exam
    ADD CONSTRAINT fk_training_exam_knowledge_folder
        FOREIGN KEY (knowledge_folder_id) REFERENCES training_folder(id) ON DELETE RESTRICT
        NOT VALID;

ALTER TABLE training_exam
    VALIDATE CONSTRAINT fk_training_exam_knowledge_folder;

-- 7) CHECK constraint (сначала NOT VALID, потом VALIDATE)
ALTER TABLE training_exam
    DROP CONSTRAINT IF EXISTS chk_training_exam_mode_knowledge_folder;

ALTER TABLE training_exam
    ADD CONSTRAINT chk_training_exam_mode_knowledge_folder CHECK (
        (mode = 'PRACTICE' AND knowledge_folder_id IS NOT NULL)
            OR
        (mode = 'CERTIFICATION' AND knowledge_folder_id IS NULL)
    ) NOT VALID;

ALTER TABLE training_exam
    VALIDATE CONSTRAINT chk_training_exam_mode_knowledge_folder;

-- 8) Индексы
CREATE INDEX IF NOT EXISTS idx_training_exam_restaurant_mode_knowledge_folder
    ON training_exam(restaurant_id, mode, knowledge_folder_id);

CREATE INDEX IF NOT EXISTS idx_training_exam_restaurant_knowledge_folder
    ON training_exam(restaurant_id, knowledge_folder_id);