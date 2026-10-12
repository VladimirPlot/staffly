BEGIN;
DELETE FROM training_question WHERE id = 10;
DELETE FROM training_folder WHERE id = 20;
COMMIT;
DO $$
DECLARE relation_name TEXT; changed BOOLEAN;
BEGIN
    IF EXISTS (SELECT 1 FROM training_folder WHERE id IN (20, 21))
       OR EXISTS (SELECT 1 FROM training_question WHERE id IN (10, 11)) THEN
        RAISE EXCEPTION 'Old bank subtree was not removed';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM training_question WHERE id = 12)
       OR NOT EXISTS (SELECT 1 FROM training_exam_source_folder WHERE folder_id = 22)
       OR NOT EXISTS (SELECT 1 FROM training_exam_source_question WHERE question_id = 12) THEN
        RAISE EXCEPTION 'Live editor sources changed';
    END IF;
    FOR relation_name IN SELECT unnest(ARRAY[
        'specifications', 'folders', 'questions', 'assignments', 'answers']) LOOP
        EXECUTE format('SELECT EXISTS ((SELECT * FROM baseline_%I EXCEPT SELECT %s FROM %I)
            UNION ALL (SELECT %s FROM %I EXCEPT SELECT * FROM baseline_%I))',
            relation_name,
            CASE WHEN relation_name = 'answers' THEN 'id, question_snapshot_json, correct_key_json, chosen_answer_json' ELSE '*' END,
            CASE relation_name WHEN 'specifications' THEN 'certification_assessment_specification'
                WHEN 'folders' THEN 'certification_assessment_folder_source'
                WHEN 'questions' THEN 'certification_assessment_question_source'
                WHEN 'assignments' THEN 'training_exam_assignment' ELSE 'training_exam_attempt_question' END,
            CASE WHEN relation_name = 'answers' THEN 'id, question_snapshot_json, correct_key_json, chosen_answer_json' ELSE '*' END,
            CASE relation_name WHEN 'specifications' THEN 'certification_assessment_specification'
                WHEN 'folders' THEN 'certification_assessment_folder_source'
                WHEN 'questions' THEN 'certification_assessment_question_source'
                WHEN 'assignments' THEN 'training_exam_assignment' ELSE 'training_exam_attempt_question' END,
            relation_name) INTO changed;
        IF changed THEN RAISE EXCEPTION 'Historical data changed: %', relation_name; END IF;
    END LOOP;
    IF EXISTS (SELECT 1 FROM training_exam_attempt_question WHERE question_id IS NOT NULL) THEN
        RAISE EXCEPTION 'Legacy attempt still references deleted live question';
    END IF;
    -- Retained FK to specification still prevents orphan historical source rows.
    BEGIN
        INSERT INTO certification_assessment_question_source (specification_id, question_id) VALUES (999999, 10);
        RAISE EXCEPTION 'Orphan specification source accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
    -- UPDATE guards remain active after source deletion.
    BEGIN
        UPDATE certification_assessment_specification SET pass_percent = 1;
        RAISE EXCEPTION 'Specification became mutable';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Certification assessment specifications are immutable' THEN RAISE; END IF;
    END;
    BEGIN
        UPDATE certification_assessment_folder_source SET folder_id = 22;
        RAISE EXCEPTION 'Folder source became mutable';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Certification assessment specifications are immutable' THEN RAISE; END IF;
    END;
    BEGIN
        UPDATE certification_assessment_question_source SET question_id = 12;
        RAISE EXCEPTION 'Question source became mutable';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Certification assessment specifications are immutable' THEN RAISE; END IF;
    END;
END $$;
