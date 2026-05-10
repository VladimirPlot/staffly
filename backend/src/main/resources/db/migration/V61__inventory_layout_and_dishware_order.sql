CREATE TABLE user_inventory_layout (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    layout JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_user_inventory_layout UNIQUE (user_id, restaurant_id)
);

CREATE INDEX idx_user_inventory_layout_restaurant
    ON user_inventory_layout (restaurant_id);

ALTER TABLE dishware_inventory
    ADD COLUMN sort_order INTEGER NOT NULL DEFAULT 0;

WITH ranked AS (
    SELECT id, row_number() OVER (
        PARTITION BY restaurant_id, folder_id
        ORDER BY inventory_date DESC, updated_at DESC, id ASC
    ) AS rn
    FROM dishware_inventory
)
UPDATE dishware_inventory inventory
SET sort_order = 100000 + ranked.rn::integer
FROM ranked
WHERE inventory.id = ranked.id;

CREATE INDEX idx_dishware_inventory_restaurant_folder_sort
    ON dishware_inventory(restaurant_id, folder_id, sort_order, id);
