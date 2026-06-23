ALTER TABLE checklist_item
    ADD COLUMN completion_photo_mode VARCHAR(20) NOT NULL DEFAULT 'NONE';

UPDATE checklist_item
SET completion_photo_mode = CASE
    WHEN completion_photo_required THEN 'REQUIRED'
    WHEN completion_photo_url IS NOT NULL AND btrim(completion_photo_url) <> '' THEN 'OPTIONAL'
    ELSE 'NONE'
END;

ALTER TABLE checklist_item
    ADD CONSTRAINT chk_checklist_item_completion_photo_mode
        CHECK (completion_photo_mode IN ('NONE', 'OPTIONAL', 'REQUIRED'));

ALTER TABLE checklist_item_history
    ADD COLUMN completion_photo_mode VARCHAR(20) NOT NULL DEFAULT 'NONE';

UPDATE checklist_item_history
SET completion_photo_mode = CASE
    WHEN completion_photo_required THEN 'REQUIRED'
    WHEN completion_photo_url IS NOT NULL AND btrim(completion_photo_url) <> '' THEN 'OPTIONAL'
    ELSE 'NONE'
END;

ALTER TABLE checklist_item_history
    ADD CONSTRAINT chk_checklist_item_history_completion_photo_mode
        CHECK (completion_photo_mode IN ('NONE', 'OPTIONAL', 'REQUIRED'));
