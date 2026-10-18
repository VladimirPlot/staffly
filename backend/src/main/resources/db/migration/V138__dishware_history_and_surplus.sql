ALTER TABLE dishware_inventory ADD COLUMN include_surplus BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE dishware_inventory ADD COLUMN has_corrections BOOLEAN NOT NULL DEFAULT FALSE;

-- Deliberately independent of the inventory FK: deleting a document must not erase its audit trail.
CREATE TABLE dishware_inventory_history (
    id BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT NOT NULL,
    restaurant_id BIGINT NOT NULL,
    actor_id BIGINT NOT NULL,
    actor_name VARCHAR(255) NOT NULL,
    action VARCHAR(40) NOT NULL,
    reason VARCHAR(1000),
    occurred_at TIMESTAMP WITH TIME ZONE NOT NULL,
    before_snapshot TEXT,
    after_snapshot TEXT
);
CREATE INDEX idx_dishware_history_inventory ON dishware_inventory_history(restaurant_id, inventory_id, id DESC);
