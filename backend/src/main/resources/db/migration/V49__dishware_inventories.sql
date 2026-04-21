CREATE TABLE dishware_inventory (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    source_inventory_id BIGINT REFERENCES dishware_inventory(id) ON DELETE SET NULL,
    source_inventory_title VARCHAR(255),
    title VARCHAR(255) NOT NULL,
    inventory_date DATE NOT NULL,
    status VARCHAR(20) NOT NULL,
    comment TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    completed_at TIMESTAMPTZ
);

CREATE INDEX idx_dishware_inventory_restaurant_date
    ON dishware_inventory(restaurant_id, inventory_date DESC, created_at DESC);

CREATE INDEX idx_dishware_inventory_source
    ON dishware_inventory(source_inventory_id);

CREATE TABLE dishware_inventory_item (
    id BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT NOT NULL REFERENCES dishware_inventory(id) ON DELETE CASCADE,
    name VARCHAR(255) NOT NULL,
    photo_url TEXT,
    previous_qty INTEGER NOT NULL DEFAULT 0,
    current_qty INTEGER NOT NULL DEFAULT 0,
    unit_price NUMERIC(16, 2),
    sort_order INTEGER NOT NULL DEFAULT 0,
    note TEXT,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishware_inventory_item_inventory_sort
    ON dishware_inventory_item(inventory_id, sort_order ASC, id ASC);
