ALTER TABLE dishware_inventory ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE dishware_inventory_item ADD COLUMN client_key VARCHAR(100);
UPDATE dishware_inventory_item SET client_key = 'item-' || id WHERE client_key IS NULL;
ALTER TABLE dishware_inventory_item ALTER COLUMN client_key SET NOT NULL;
CREATE UNIQUE INDEX uq_dishware_inventory_item_client_key ON dishware_inventory_item(inventory_id, client_key);

CREATE TABLE dishware_inventory_save_receipt (
    id BIGSERIAL PRIMARY KEY,
    inventory_id BIGINT NOT NULL REFERENCES dishware_inventory(id) ON DELETE CASCADE,
    request_id UUID NOT NULL,
    payload_hash VARCHAR(64) NOT NULL,
    applied_version BIGINT NOT NULL,
    UNIQUE (inventory_id, request_id)
);
