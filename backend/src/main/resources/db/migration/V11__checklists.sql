CREATE TABLE checklist (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    name VARCHAR(200) NOT NULL,
    content TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now() NOT NULL
);

CREATE INDEX idx_checklist_restaurant ON checklist(restaurant_id);

CREATE TABLE checklist_position (
    checklist_id BIGINT NOT NULL REFERENCES checklist(id) ON DELETE CASCADE,
    position_id BIGINT NOT NULL REFERENCES position(id) ON DELETE CASCADE,
    PRIMARY KEY (checklist_id, position_id)
);

CREATE INDEX idx_checklist_position_position ON checklist_position(position_id);