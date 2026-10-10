ALTER TABLE checklist ADD COLUMN version BIGINT NOT NULL DEFAULT 0;
ALTER TABLE checklist ADD COLUMN deleted_at TIMESTAMPTZ;
CREATE INDEX idx_checklist_active_restaurant ON checklist(restaurant_id) WHERE deleted_at IS NULL;
DROP INDEX uq_checklist_history_checklist_reset_reason;
CREATE UNIQUE INDEX uq_checklist_history_auto_reset
    ON checklist_history(checklist_id, reset_at) WHERE checklist_id IS NOT NULL AND reset_reason = 'AUTO';
