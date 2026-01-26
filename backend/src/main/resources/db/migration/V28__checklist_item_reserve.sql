ALTER TABLE checklist_item
    ADD COLUMN reserved_by_member_id BIGINT REFERENCES restaurant_member(id),
    ADD COLUMN reserved_at TIMESTAMPTZ;

CREATE INDEX idx_checklist_item_reserved_by ON checklist_item(reserved_by_member_id);