CREATE TABLE common_schedule (
    id BIGSERIAL PRIMARY KEY,
    version BIGINT NOT NULL DEFAULT 0,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title VARCHAR(255) NOT NULL,
    visible_to_positions BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX idx_common_schedule_restaurant ON common_schedule(restaurant_id);

-- Order zero is the primary schedule. Sources own all rows and cells.
CREATE TABLE common_schedule_source (
    common_schedule_id BIGINT NOT NULL REFERENCES common_schedule(id) ON DELETE CASCADE,
    -- Allow restaurant cascades to remove schedules and common schedules in either order.
    schedule_id BIGINT NOT NULL REFERENCES schedule(id) DEFERRABLE INITIALLY DEFERRED,
    source_order INTEGER NOT NULL CHECK (source_order >= 0),
    PRIMARY KEY (common_schedule_id, source_order),
    -- Reordering a managed Hibernate list may temporarily repeat a source.
    UNIQUE (common_schedule_id, schedule_id) DEFERRABLE INITIALLY DEFERRED
);
CREATE INDEX idx_common_schedule_source_schedule ON common_schedule_source(schedule_id);
