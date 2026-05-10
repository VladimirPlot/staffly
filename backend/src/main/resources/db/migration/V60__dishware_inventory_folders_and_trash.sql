CREATE TABLE dishware_inventory_folder (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    parent_id BIGINT REFERENCES dishware_inventory_folder(id) ON DELETE CASCADE,
    name VARCHAR(150) NOT NULL,
    description TEXT,
    sort_order INTEGER NOT NULL DEFAULT 0,
    trashed_at TIMESTAMPTZ,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_dishware_inventory_folder_restaurant_parent
    ON dishware_inventory_folder(restaurant_id, parent_id);

CREATE INDEX idx_dishware_inventory_folder_trash
    ON dishware_inventory_folder(restaurant_id, trashed_at);

ALTER TABLE dishware_inventory
    ADD COLUMN folder_id BIGINT REFERENCES dishware_inventory_folder(id) ON DELETE SET NULL,
    ADD COLUMN trashed_at TIMESTAMPTZ;

CREATE INDEX idx_dishware_inventory_restaurant_folder
    ON dishware_inventory(restaurant_id, folder_id);

CREATE INDEX idx_dishware_inventory_trash
    ON dishware_inventory(restaurant_id, trashed_at);
