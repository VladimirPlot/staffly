-- Legacy versions adopt currently available sources. Existing attempt snapshots/results are untouched.
ALTER TABLE certification_assessment_specification ADD COLUMN question_pool_json TEXT;
ALTER TABLE certification_assessment_specification DISABLE TRIGGER certification_specification_no_update;

WITH question_payload AS (
    SELECT q.id, q.restaurant_id, q.folder_id,
           jsonb_build_object(
               'questionId', q.id, 'type', q.type, 'prompt', q.prompt, 'explanation', q.explanation,
               'options', COALESCE((SELECT jsonb_agg(jsonb_build_object('sortOrder', o.sort_order, 'text', o.text)
                   ORDER BY o.sort_order, o.id) FROM training_question_option o WHERE o.question_id = q.id), '[]'::jsonb),
               'matchPairs', COALESCE((SELECT jsonb_agg(jsonb_build_object('sortOrder', p.sort_order,
                   'leftText', p.left_text, 'rightText', p.right_text) ORDER BY p.sort_order, p.id)
                   FROM training_question_match_pair p WHERE p.question_id = q.id), '[]'::jsonb),
               'blanks', COALESCE((SELECT jsonb_agg(jsonb_build_object('blankIndex', b.sort_order + 1,
                   'options', COALESCE((SELECT jsonb_agg(jsonb_build_object('sortOrder', o.sort_order, 'text', o.text)
                       ORDER BY o.sort_order, o.id) FROM training_question_blank_option o WHERE o.blank_id = b.id), '[]'::jsonb))
                   ORDER BY b.sort_order, b.id) FROM training_question_blank b WHERE b.question_id = q.id), '[]'::jsonb)
           )::text AS snapshot_json,
           (CASE
               WHEN q.type = 'MATCH' THEN COALESCE((SELECT jsonb_agg(jsonb_build_object('left', p.left_text, 'right', p.right_text)
                   ORDER BY p.left_text COLLATE "C") FROM training_question_match_pair p WHERE p.question_id = q.id), '[]'::jsonb)
               WHEN q.type = 'MULTI' THEN COALESCE((SELECT jsonb_agg(to_jsonb(o.text) ORDER BY o.text COLLATE "C")
                   FROM training_question_option o WHERE o.question_id = q.id AND o.is_correct), '[]'::jsonb)
               WHEN q.type = 'FILL_SELECT' AND EXISTS (SELECT 1 FROM training_question_blank b WHERE b.question_id = q.id)
                   THEN (SELECT jsonb_agg(jsonb_build_object('blankIndex', b.sort_order + 1, 'correct',
                       COALESCE((SELECT o.text FROM training_question_blank_option o WHERE o.blank_id = b.id AND o.is_correct
                           ORDER BY o.sort_order, o.id LIMIT 1), '')) ORDER BY b.sort_order, b.id)
                       FROM training_question_blank b WHERE b.question_id = q.id)
               ELSE to_jsonb(COALESCE((SELECT o.text FROM training_question_option o WHERE o.question_id = q.id AND o.is_correct
                   ORDER BY o.sort_order, o.id LIMIT 1), ''))
           END)::text AS correct_key_json
    FROM training_question q WHERE q.is_active AND q.question_group = 'CERTIFICATION'
)
UPDATE certification_assessment_specification s
SET question_pool_json = COALESCE((
    SELECT jsonb_agg(jsonb_build_object('questionId', q.id, 'folderId', q.folder_id,
        'snapshotJson', q.snapshot_json, 'correctKeyJson', q.correct_key_json) ORDER BY q.id)::text
    FROM question_payload q JOIN training_exam e ON e.id = s.exam_id AND e.restaurant_id = q.restaurant_id
    WHERE EXISTS (SELECT 1 FROM certification_assessment_folder_source f WHERE f.specification_id = s.id AND f.folder_id = q.folder_id)
       OR EXISTS (SELECT 1 FROM certification_assessment_question_source x WHERE x.specification_id = s.id AND x.question_id = q.id)
), '[]');

ALTER TABLE certification_assessment_specification ALTER COLUMN question_pool_json SET NOT NULL;
ALTER TABLE certification_assessment_specification ADD CONSTRAINT certification_question_pool_array
    CHECK (jsonb_typeof(question_pool_json::jsonb) = 'array');
ALTER TABLE certification_assessment_specification ENABLE TRIGGER certification_specification_no_update;
