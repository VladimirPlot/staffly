CREATE TABLE announcement_operations (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    actor_id BIGINT NOT NULL,
    operation_id UUID NOT NULL,
    request_hash VARCHAR(64) NOT NULL,
    message_id BIGINT REFERENCES inbox_messages(id) ON DELETE SET NULL,
    CONSTRAINT uq_announcement_operation UNIQUE (restaurant_id, actor_id, operation_id)
);
CREATE INDEX idx_announcement_operations_message ON announcement_operations(message_id);

-- Older names can only be recovered from the current profile. New sends snapshot at creation.
UPDATE inbox_messages m
SET metadata = jsonb_set(m.metadata, '{announcement,author}', COALESCE((
    SELECT jsonb_build_object('id', NULL, 'name',
        COALESCE(NULLIF(trim(concat_ws(' ', u.first_name, u.last_name)), ''), u.full_name),
        'firstName', u.first_name, 'lastName', u.last_name)
    FROM users u WHERE u.id = m.created_by_user_id
), 'null'::jsonb)),
    created_by_user_id = NULL
WHERE m.type = 'ANNOUNCEMENT';
