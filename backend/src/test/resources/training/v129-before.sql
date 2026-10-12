CREATE TABLE training_folder (id BIGINT PRIMARY KEY, parent_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE, is_active BOOLEAN);
CREATE TABLE training_knowledge_item (id BIGINT PRIMARY KEY, folder_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE, is_active BOOLEAN);
CREATE TABLE training_question (id BIGINT PRIMARY KEY, folder_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE, is_active BOOLEAN);
CREATE TABLE training_exam (id BIGINT PRIMARY KEY, folder_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE, is_active BOOLEAN);
INSERT INTO training_folder VALUES (1, NULL, false), (2, 1, false), (3, 2, false);
INSERT INTO training_knowledge_item VALUES (1, 3, false);
INSERT INTO training_question VALUES (1, 3, false);
INSERT INTO training_exam VALUES (1, 3, false);
