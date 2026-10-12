-- Minimal live schema for the real V83/V128/V129/V131 migrations.
CREATE TABLE training_folder (id BIGINT PRIMARY KEY,
    parent_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE, is_active BOOLEAN NOT NULL);
CREATE TABLE training_exam (id BIGINT PRIMARY KEY, restaurant_id BIGINT, mode TEXT,
    version INT, question_count INT, pass_percent INT, time_limit_sec INT, attempt_limit INT,
    updated_at TIMESTAMPTZ, created_at TIMESTAMPTZ);
CREATE TABLE training_question (id BIGINT PRIMARY KEY, restaurant_id BIGINT,
    folder_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE,
    type TEXT, prompt TEXT, explanation TEXT, is_active BOOLEAN, question_group TEXT);
CREATE TABLE training_knowledge_item (id BIGINT PRIMARY KEY,
    folder_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE);
CREATE TABLE training_exam_source_folder (exam_id BIGINT REFERENCES training_exam(id),
    folder_id BIGINT REFERENCES training_folder(id) ON DELETE CASCADE, pick_mode TEXT, random_count INT);
CREATE TABLE training_exam_source_question (exam_id BIGINT REFERENCES training_exam(id),
    question_id BIGINT REFERENCES training_question(id) ON DELETE CASCADE);
CREATE TABLE training_exam_assignment (id BIGINT PRIMARY KEY, exam_id BIGINT,
    exam_version_snapshot INT, attempts_limit_snapshot INT, assigned_at TIMESTAMPTZ,
    status TEXT, score_percent INT);
CREATE TABLE training_exam_attempt_question (id BIGINT PRIMARY KEY,
    question_id BIGINT REFERENCES training_question(id) ON DELETE SET NULL,
    question_snapshot_json TEXT, correct_key_json TEXT, chosen_answer_json TEXT);
CREATE TABLE training_question_option (id BIGINT, question_id BIGINT REFERENCES training_question(id) ON DELETE CASCADE,
    text TEXT, is_correct BOOLEAN, sort_order INT);
CREATE TABLE training_question_match_pair (id BIGINT, question_id BIGINT, left_text TEXT, right_text TEXT, sort_order INT);
CREATE TABLE training_question_blank (id BIGINT, question_id BIGINT, sort_order INT);
CREATE TABLE training_question_blank_option (id BIGINT, blank_id BIGINT, text TEXT, is_correct BOOLEAN, sort_order INT);
INSERT INTO training_folder VALUES (20, NULL, true), (21, 20, true), (22, NULL, true);
INSERT INTO training_exam VALUES (1, 1, 'CERTIFICATION', 2, 2, 70, 120, 3, now(), now());
INSERT INTO training_question VALUES
    (10, 1, 21, 'SINGLE', 'Historical prompt', NULL, true, 'CERTIFICATION'),
    (11, 1, 21, 'SINGLE', 'Random candidate', NULL, true, 'CERTIFICATION'),
    (12, 1, 22, 'SINGLE', 'Current source', NULL, true, 'CERTIFICATION');
INSERT INTO training_question_option VALUES (1, 10, 'correct', true, 0), (2, 11, 'other correct', true, 0);
INSERT INTO training_exam_source_folder VALUES (1, 21, 'RANDOM', 1);
INSERT INTO training_exam_source_question VALUES (1, 10);
INSERT INTO training_exam_assignment VALUES (100, 1, 1, 3, now(), 'PASSED', 100);
INSERT INTO training_exam_attempt_question VALUES (200, 10, 'historical snapshot', 'historical key', 'confirmed answer');
