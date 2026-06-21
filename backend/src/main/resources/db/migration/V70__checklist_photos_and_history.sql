ALTER TABLE checklist_item
    ADD COLUMN example_photo_url TEXT,
    ADD COLUMN completion_photo_url TEXT,
    ADD COLUMN completion_photo_required BOOLEAN NOT NULL DEFAULT FALSE,
    ADD COLUMN completion_photo_uploaded_at TIMESTAMPTZ,
    ADD COLUMN completion_photo_uploaded_by_member_id BIGINT REFERENCES restaurant_member(id) ON DELETE SET NULL;

CREATE INDEX idx_checklist_item_completion_photo_uploaded_by
    ON checklist_item(completion_photo_uploaded_by_member_id);

CREATE TABLE checklist_history (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    checklist_id BIGINT REFERENCES checklist(id) ON DELETE SET NULL,
    checklist_name VARCHAR(200) NOT NULL,
    kind VARCHAR(20) NOT NULL,
    periodicity VARCHAR(20),
    reset_time TIME,
    reset_day_of_week INT,
    reset_day_of_month INT,
    started_at TIMESTAMPTZ,
    reset_at TIMESTAMPTZ NOT NULL,
    reset_reason VARCHAR(20) NOT NULL,
    completed BOOLEAN NOT NULL DEFAULT FALSE,
    total_items INT NOT NULL DEFAULT 0,
    completed_items INT NOT NULL DEFAULT 0,
    positions_snapshot TEXT
);

CREATE INDEX idx_checklist_history_restaurant_reset
    ON checklist_history(restaurant_id, reset_at DESC);

CREATE INDEX idx_checklist_history_checklist_reset
    ON checklist_history(checklist_id, reset_at DESC);

CREATE UNIQUE INDEX uq_checklist_history_checklist_reset_reason
    ON checklist_history(checklist_id, reset_at, reset_reason)
    WHERE checklist_id IS NOT NULL;

CREATE TABLE checklist_item_history (
    id BIGSERIAL PRIMARY KEY,
    history_id BIGINT NOT NULL REFERENCES checklist_history(id) ON DELETE CASCADE,
    source_item_id BIGINT REFERENCES checklist_item(id) ON DELETE SET NULL,
    item_order INT NOT NULL,
    text TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    done_by_member_id BIGINT REFERENCES restaurant_member(id) ON DELETE SET NULL,
    done_by_name VARCHAR(255),
    done_at TIMESTAMPTZ,
    reserved_by_member_id BIGINT REFERENCES restaurant_member(id) ON DELETE SET NULL,
    reserved_by_name VARCHAR(255),
    reserved_at TIMESTAMPTZ,
    completion_photo_required BOOLEAN NOT NULL DEFAULT FALSE,
    example_photo_url TEXT,
    completion_photo_url TEXT
);

CREATE INDEX idx_checklist_item_history_history_order
    ON checklist_item_history(history_id, item_order);

CREATE INDEX idx_checklist_item_history_source_item
    ON checklist_item_history(source_item_id);

CREATE INDEX idx_checklist_item_history_example_photo_url
    ON checklist_item_history(example_photo_url)
    WHERE example_photo_url IS NOT NULL;

CREATE INDEX idx_checklist_item_history_completion_photo_url
    ON checklist_item_history(completion_photo_url)
    WHERE completion_photo_url IS NOT NULL;
