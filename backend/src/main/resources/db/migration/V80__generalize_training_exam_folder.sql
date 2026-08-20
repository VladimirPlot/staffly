ALTER TABLE training_exam
    RENAME COLUMN knowledge_folder_id TO folder_id;

-- PostgreSQL keeps the FK and CHECK definitions attached to the renamed column.
-- Rename their identifiers as well so the schema terminology matches the relation.
ALTER TABLE training_exam
    RENAME CONSTRAINT fk_training_exam_knowledge_folder TO fk_training_exam_folder;

ALTER TABLE training_exam
    RENAME CONSTRAINT chk_training_exam_mode_knowledge_folder TO chk_training_exam_mode_folder;

ALTER INDEX idx_training_exam_restaurant_mode_knowledge_folder
    RENAME TO idx_training_exam_restaurant_mode_folder;

ALTER INDEX idx_training_exam_restaurant_knowledge_folder
    RENAME TO idx_training_exam_restaurant_folder;

ALTER INDEX idx_training_exam_restaurant_knowledge_folder_sort
    RENAME TO idx_training_exam_restaurant_folder_sort;
