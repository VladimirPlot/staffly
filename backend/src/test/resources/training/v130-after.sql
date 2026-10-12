DO $$
BEGIN
    IF NOT EXISTS (SELECT 1 FROM training_knowledge_item WHERE id = 1
        AND title = 'Existing card' AND image_url = 'old-photo' AND NOT is_active
        AND creation_request_id IS NULL AND creation_request_hash IS NULL) THEN
        RAISE EXCEPTION 'Existing card changed';
    END IF;
END $$;
INSERT INTO training_knowledge_item VALUES
    (2, 10, 'New card', NULL, true, '11111111-1111-4111-8111-111111111111', repeat('a', 64)),
    (3, 11, 'Other restaurant', NULL, true, '11111111-1111-4111-8111-111111111111', repeat('b', 64));
DO $$
BEGIN
    BEGIN
        INSERT INTO training_knowledge_item VALUES
            (4, 10, 'Duplicate', NULL, true, '11111111-1111-4111-8111-111111111111', repeat('a', 64));
        RAISE EXCEPTION 'Duplicate request accepted';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO training_knowledge_item VALUES
            (5, 10, 'Missing hash', NULL, true, '22222222-2222-4222-8222-222222222222', NULL);
        RAISE EXCEPTION 'Missing hash accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
    BEGIN
        INSERT INTO training_knowledge_item VALUES
            (6, 10, 'Invalid hash', NULL, true, '22222222-2222-4222-8222-222222222222', 'short');
        RAISE EXCEPTION 'Short hash accepted';
    EXCEPTION WHEN check_violation THEN NULL;
    END;
END $$;
