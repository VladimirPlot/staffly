ALTER TABLE training_exam
    ADD COLUMN IF NOT EXISTS sort_order INT NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_training_exam_restaurant_knowledge_folder_sort
    ON training_exam(restaurant_id, knowledge_folder_id, sort_order, id);
