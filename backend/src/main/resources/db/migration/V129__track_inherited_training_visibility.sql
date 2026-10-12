-- Null means independently hidden (or legacy unknown provenance). Never infer legacy intent.
-- Check origin references after cascading subtree deletion, without updating rows being deleted.
ALTER TABLE training_folder ADD COLUMN hidden_by_folder_id BIGINT REFERENCES training_folder(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE training_knowledge_item ADD COLUMN hidden_by_folder_id BIGINT REFERENCES training_folder(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE training_question ADD COLUMN hidden_by_folder_id BIGINT REFERENCES training_folder(id) DEFERRABLE INITIALLY DEFERRED;
ALTER TABLE training_exam ADD COLUMN hidden_by_folder_id BIGINT REFERENCES training_folder(id) DEFERRABLE INITIALLY DEFERRED;
CREATE INDEX idx_training_folder_hidden_by ON training_folder(hidden_by_folder_id) WHERE hidden_by_folder_id IS NOT NULL;
CREATE INDEX idx_training_item_hidden_by ON training_knowledge_item(hidden_by_folder_id) WHERE hidden_by_folder_id IS NOT NULL;
CREATE INDEX idx_training_question_hidden_by ON training_question(hidden_by_folder_id) WHERE hidden_by_folder_id IS NOT NULL;
CREATE INDEX idx_training_exam_hidden_by ON training_exam(hidden_by_folder_id) WHERE hidden_by_folder_id IS NOT NULL;
