DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM training_folder WHERE is_active OR hidden_by_folder_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM training_knowledge_item WHERE is_active OR hidden_by_folder_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM training_question WHERE is_active OR hidden_by_folder_id IS NOT NULL)
       OR EXISTS (SELECT 1 FROM training_exam WHERE is_active OR hidden_by_folder_id IS NOT NULL)
    THEN RAISE EXCEPTION 'Migration changed legacy visibility or invented provenance'; END IF;
    UPDATE training_folder SET hidden_by_folder_id = 1 WHERE id IN (2, 3);
    UPDATE training_knowledge_item SET hidden_by_folder_id = 1;
    UPDATE training_question SET hidden_by_folder_id = 1;
    UPDATE training_exam SET hidden_by_folder_id = 1;
    DELETE FROM training_folder WHERE id = 1;
    IF EXISTS (SELECT 1 FROM training_folder) OR EXISTS (SELECT 1 FROM training_knowledge_item)
       OR EXISTS (SELECT 1 FROM training_question) OR EXISTS (SELECT 1 FROM training_exam)
    THEN RAISE EXCEPTION 'Inherited visibility prevented cascading subtree deletion'; END IF;
    INSERT INTO training_folder VALUES (10, NULL, false, NULL);
    BEGIN
        UPDATE training_folder SET hidden_by_folder_id = 999 WHERE id = 10;
        SET CONSTRAINTS ALL IMMEDIATE;
        RAISE EXCEPTION 'Missing hide origin was accepted';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END $$;
SELECT 'V129 migration assertions passed' AS result;
