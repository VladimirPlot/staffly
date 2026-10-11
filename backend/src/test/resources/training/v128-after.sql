DO $$
DECLARE pool JSONB; item JSONB;
BEGIN
    SELECT question_pool_json::jsonb INTO pool FROM certification_assessment_specification WHERE id = 10;
    IF jsonb_array_length(pool) <> 6 THEN RAISE EXCEPTION 'Wrong available pool'; END IF;
    IF (pool->0->>'snapshotJson')::jsonb->>'prompt' <> 'Старая формулировка' THEN RAISE EXCEPTION 'Lost prompt'; END IF;
    IF (pool->0->>'correctKeyJson')::jsonb <> '"Верно"'::jsonb THEN RAISE EXCEPTION 'Wrong single key'; END IF;
    IF (pool->1->>'correctKeyJson')::jsonb <> '["A","B"]'::jsonb THEN RAISE EXCEPTION 'Wrong multi key'; END IF;
    IF (pool->2->>'correctKeyJson')::jsonb <> '"true"'::jsonb THEN RAISE EXCEPTION 'Wrong boolean key'; END IF;
    item := (pool->3->>'snapshotJson')::jsonb;
    IF item->'matchPairs'->0->>'leftText' <> 'B' OR item->'matchPairs'->0->>'rightText' <> '2'
        THEN RAISE EXCEPTION 'Wrong match DTO shape'; END IF;
    IF (pool->3->>'correctKeyJson')::jsonb <> '[{"left":"A","right":"1"},{"left":"B","right":"2"}]'::jsonb
        THEN RAISE EXCEPTION 'Wrong match key'; END IF;
    IF (pool->4->>'correctKeyJson')::jsonb <> '[{"blankIndex":1,"correct":"first"},{"blankIndex":2,"correct":"second"}]'::jsonb
        THEN RAISE EXCEPTION 'Wrong fill key'; END IF;
    IF (pool->4->>'snapshotJson')::jsonb->'blanks'->0->>'blankIndex' <> '1' THEN RAISE EXCEPTION 'Wrong blank index'; END IF;
    IF (pool->5->>'correctKeyJson')::jsonb <> '"old"'::jsonb THEN RAISE EXCEPTION 'Wrong legacy fill'; END IF;
    IF (SELECT question_pool_json FROM certification_assessment_specification WHERE id = 11) <> '[]'
        THEN RAISE EXCEPTION 'Empty sources should be frozen empty'; END IF;
    UPDATE training_question SET prompt = 'Changed', is_active = false;
    DELETE FROM training_question_option;
    IF (SELECT question_pool_json::jsonb FROM certification_assessment_specification WHERE id = 10) <> pool
        THEN RAISE EXCEPTION 'Published pool changed'; END IF;
    IF NOT EXISTS (SELECT 1 FROM training_exam_attempt_question WHERE question_snapshot_json = 'historical snapshot'
        AND correct_key_json = 'historical key' AND chosen_answer_json = 'saved answer')
        THEN RAISE EXCEPTION 'Historical attempt changed'; END IF;
    BEGIN
        UPDATE certification_assessment_specification SET question_pool_json = '[]' WHERE id = 10;
        RAISE EXCEPTION 'Immutable trigger was not restored';
    EXCEPTION WHEN raise_exception THEN
        IF SQLERRM <> 'Certification assessment specifications are immutable' THEN RAISE; END IF;
    END;
END $$;
SELECT 'V128 migration assertions passed' AS result;
