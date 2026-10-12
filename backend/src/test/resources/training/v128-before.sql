-- Minimal PostgreSQL fixture for V128, including every supported answer format.
CREATE TABLE training_exam (id BIGINT PRIMARY KEY, restaurant_id BIGINT);
CREATE TABLE certification_assessment_specification (id BIGINT PRIMARY KEY, exam_id BIGINT);
CREATE TABLE certification_assessment_folder_source (specification_id BIGINT, folder_id BIGINT);
CREATE TABLE certification_assessment_question_source (specification_id BIGINT, question_id BIGINT);
CREATE TABLE training_question (id BIGINT PRIMARY KEY, restaurant_id BIGINT, folder_id BIGINT,
    type TEXT, prompt TEXT, explanation TEXT, is_active BOOLEAN, question_group TEXT);
CREATE TABLE training_question_option (id BIGINT, question_id BIGINT, text TEXT, is_correct BOOLEAN, sort_order INT);
CREATE TABLE training_question_match_pair (id BIGINT, question_id BIGINT, left_text TEXT, right_text TEXT, sort_order INT);
CREATE TABLE training_question_blank (id BIGINT, question_id BIGINT, sort_order INT);
CREATE TABLE training_question_blank_option (id BIGINT, blank_id BIGINT, text TEXT, is_correct BOOLEAN, sort_order INT);
CREATE TABLE training_exam_attempt_question (question_snapshot_json TEXT, correct_key_json TEXT, chosen_answer_json TEXT);
CREATE FUNCTION reject_certification_specification_update() RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Certification assessment specifications are immutable'; END $$;
CREATE TRIGGER certification_specification_no_update BEFORE UPDATE ON certification_assessment_specification
    FOR EACH ROW EXECUTE FUNCTION reject_certification_specification_update();
INSERT INTO training_exam VALUES (1, 1), (2, 1);
INSERT INTO certification_assessment_specification VALUES (10, 1), (11, 2);
INSERT INTO certification_assessment_folder_source VALUES (10, 20);
INSERT INTO certification_assessment_question_source VALUES (10, 6);
INSERT INTO training_question VALUES
    (1, 1, 20, 'SINGLE', 'Старая формулировка', 'Объяснение', true, 'CERTIFICATION'),
    (2, 1, 20, 'MULTI', 'Multi', NULL, true, 'CERTIFICATION'),
    (3, 1, 20, 'TRUE_FALSE', 'Boolean', NULL, true, 'CERTIFICATION'),
    (4, 1, 20, 'MATCH', 'Match', NULL, true, 'CERTIFICATION'),
    (5, 1, 20, 'FILL_SELECT', 'Fill', NULL, true, 'CERTIFICATION'),
    (6, 1, 21, 'FILL_SELECT', 'Legacy fill', NULL, true, 'CERTIFICATION'),
    (7, 1, 20, 'SINGLE', 'Hidden', NULL, false, 'CERTIFICATION'),
    (8, 1, 20, 'SINGLE', 'Practice', NULL, true, 'PRACTICE'),
    (9, 2, 20, 'SINGLE', 'Other restaurant', NULL, true, 'CERTIFICATION');
INSERT INTO training_question_option VALUES
    (1, 1, 'Верно', true, 0), (2, 1, 'Неверно', false, 1),
    (3, 2, 'B', true, 0), (4, 2, 'A', true, 1), (5, 2, 'C', false, 2),
    (6, 3, 'true', true, 0), (7, 3, 'false', false, 1), (8, 6, 'old', true, 0);
INSERT INTO training_question_match_pair VALUES (1, 4, 'B', '2', 0), (2, 4, 'A', '1', 1);
INSERT INTO training_question_blank VALUES (1, 5, 0), (2, 5, 1);
INSERT INTO training_question_blank_option VALUES (1, 1, 'first', true, 0), (2, 1, 'wrong', false, 1), (3, 2, 'second', true, 0);
INSERT INTO training_exam_attempt_question VALUES ('historical snapshot', 'historical key', 'saved answer');
