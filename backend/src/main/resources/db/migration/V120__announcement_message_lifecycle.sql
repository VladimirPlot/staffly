-- Preserve the hidden state of expired announcements, including superseded revisions,
-- before removing their legacy expiry. Read and explicitly archived states stay intact.
UPDATE inbox_recipients r
SET archived_at = COALESCE(r.archived_at, now())
FROM inbox_messages m
JOIN restaurants restaurant ON restaurant.id = m.restaurant_id
WHERE r.message_id = m.id
  AND m.type = 'ANNOUNCEMENT'
  AND m.expires_at < (now() AT TIME ZONE restaurant.timezone)::date;

UPDATE inbox_messages
SET expires_at = NULL
WHERE type = 'ANNOUNCEMENT' AND expires_at IS NOT NULL;

ALTER TABLE inbox_messages
    ADD CONSTRAINT chk_announcement_without_expiry
    CHECK (type <> 'ANNOUNCEMENT' OR expires_at IS NULL);
