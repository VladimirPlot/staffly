ALTER TABLE training_knowledge_item ADD COLUMN original_image_url TEXT;

ALTER TABLE training_knowledge_item ADD CONSTRAINT chk_knowledge_original_has_preview
    CHECK (original_image_url IS NULL OR image_url IS NOT NULL);
