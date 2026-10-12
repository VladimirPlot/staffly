ALTER TABLE training_knowledge_item ADD COLUMN creation_request_id UUID;
ALTER TABLE training_knowledge_item ADD COLUMN creation_request_hash VARCHAR(64);
CREATE UNIQUE INDEX uq_training_item_creation_request
    ON training_knowledge_item(restaurant_id, creation_request_id) WHERE creation_request_id IS NOT NULL;
ALTER TABLE training_knowledge_item ADD CONSTRAINT chk_training_item_creation_request
    CHECK ((creation_request_id IS NULL AND creation_request_hash IS NULL)
        OR (creation_request_id IS NOT NULL AND creation_request_hash IS NOT NULL AND length(creation_request_hash) = 64));
