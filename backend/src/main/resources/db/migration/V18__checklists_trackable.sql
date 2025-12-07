ALTER TABLE checklist
    ADD COLUMN kind VARCHAR(20) NOT NULL DEFAULT 'INFO',
    ADD COLUMN periodicity VARCHAR(20),
    ADD COLUMN reset_time TIME,
    ADD COLUMN reset_day_of_week INT,
    ADD COLUMN reset_day_of_month INT,
    ADD COLUMN last_reset_at TIMESTAMPTZ DEFAULT now(),
    ADD COLUMN completed BOOLEAN NOT NULL DEFAULT FALSE;

ALTER TABLE checklist
    ALTER COLUMN content DROP NOT NULL;

CREATE TABLE checklist_item (
    id BIGSERIAL PRIMARY KEY,
    checklist_id BIGINT NOT NULL REFERENCES checklist(id) ON DELETE CASCADE,
    item_order INT NOT NULL,
    text TEXT NOT NULL,
    done BOOLEAN NOT NULL DEFAULT FALSE,
    done_by_member_id BIGINT REFERENCES restaurant_member(id),
    done_at TIMESTAMPTZ,
    CONSTRAINT uq_checklist_item_order UNIQUE (checklist_id, item_order)
);

CREATE INDEX idx_checklist_item_checklist ON checklist_item(checklist_id);