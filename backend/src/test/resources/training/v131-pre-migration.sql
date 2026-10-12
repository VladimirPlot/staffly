-- The old publication is no longer selected by the live editor.
DELETE FROM training_exam_source_folder;
DELETE FROM training_exam_source_question;
INSERT INTO training_exam_source_folder VALUES (1, 22, 'ALL', NULL);
INSERT INTO training_exam_source_question VALUES (1, 12);
UPDATE training_folder SET is_active = false WHERE id IN (20, 21);
UPDATE training_question SET is_active = false WHERE id IN (10, 11);
CREATE TEMP TABLE baseline_specifications AS SELECT * FROM certification_assessment_specification;
CREATE TEMP TABLE baseline_folders AS SELECT * FROM certification_assessment_folder_source;
CREATE TEMP TABLE baseline_questions AS SELECT * FROM certification_assessment_question_source;
CREATE TEMP TABLE baseline_assignments AS SELECT * FROM training_exam_assignment;
CREATE TEMP TABLE baseline_answers AS SELECT id, question_snapshot_json, correct_key_json, chosen_answer_json
    FROM training_exam_attempt_question;
DO $$
BEGIN
    BEGIN
        DELETE FROM training_question WHERE id = 10;
        RAISE EXCEPTION 'Old question unexpectedly deletable before migration';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    BEGIN
        DELETE FROM training_folder WHERE id = 20;
        RAISE EXCEPTION 'Old subtree unexpectedly deletable before migration';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END $$;
