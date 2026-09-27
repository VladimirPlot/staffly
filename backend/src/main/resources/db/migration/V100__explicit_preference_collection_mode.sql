ALTER TABLE schedule ADD COLUMN preference_collection_mode VARCHAR(32);

-- Before this migration every started collection required a Build Template and
-- therefore used the shift-option collection flow.
UPDATE schedule
SET preference_collection_mode = 'SHIFT_OPTIONS'
WHERE preference_collection_started_at IS NOT NULL;

ALTER TABLE schedule ADD CONSTRAINT ck_schedule_preference_collection_mode
    CHECK (preference_collection_mode IS NULL
        OR preference_collection_mode IN ('DAY_LEVEL', 'SHIFT_OPTIONS'));

ALTER TABLE schedule ADD CONSTRAINT ck_schedule_preference_collection_template
    CHECK ((preference_collection_mode IS NULL AND preference_build_template_id IS NULL)
        OR (preference_collection_mode = 'DAY_LEVEL' AND preference_build_template_id IS NULL)
        OR (preference_collection_mode = 'SHIFT_OPTIONS' AND preference_build_template_id IS NOT NULL));

ALTER TABLE schedule_preference_submission DROP COLUMN IF EXISTS comment;
