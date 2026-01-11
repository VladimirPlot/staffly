CREATE TABLE inbox_messages (
    id BIGSERIAL PRIMARY KEY,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    type VARCHAR(20) NOT NULL,
    event_subtype VARCHAR(40),
    content TEXT NOT NULL,
    expires_at DATE,
    created_at TIMESTAMP NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP NOT NULL DEFAULT NOW(),
    created_by_user_id BIGINT REFERENCES users(id),
    meta TEXT NOT NULL,
    CONSTRAINT uq_inbox_message_restaurant_type_meta UNIQUE (restaurant_id, type, meta)
);

CREATE INDEX idx_inbox_messages_restaurant ON inbox_messages(restaurant_id);
CREATE INDEX idx_inbox_messages_type ON inbox_messages(type);
CREATE INDEX idx_inbox_messages_expires ON inbox_messages(expires_at);
CREATE INDEX idx_inbox_messages_restaurant_type ON inbox_messages(restaurant_id, type);

CREATE TABLE inbox_message_positions (
    message_id BIGINT NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
    position_id BIGINT NOT NULL REFERENCES position(id) ON DELETE CASCADE,
    PRIMARY KEY (message_id, position_id)
);

CREATE INDEX idx_inbox_message_positions_position ON inbox_message_positions(position_id);

CREATE TABLE inbox_recipients (
    id BIGSERIAL PRIMARY KEY,
    message_id BIGINT NOT NULL REFERENCES inbox_messages(id) ON DELETE CASCADE,
    member_id BIGINT NOT NULL REFERENCES restaurant_member(id) ON DELETE CASCADE,
    delivered_at TIMESTAMP NOT NULL DEFAULT NOW(),
    read_at TIMESTAMP,
    archived_at TIMESTAMP,
    CONSTRAINT uq_inbox_recipient UNIQUE (message_id, member_id)
);

CREATE INDEX idx_inbox_recipients_member ON inbox_recipients(member_id);
CREATE INDEX idx_inbox_recipients_message ON inbox_recipients(message_id);
CREATE INDEX idx_inbox_recipients_member_archived ON inbox_recipients(member_id, archived_at);

INSERT INTO inbox_messages (id, restaurant_id, type, content, expires_at, created_at, updated_at, created_by_user_id, meta)
SELECT id,
       restaurant_id,
       'ANNOUNCEMENT',
       content,
       expires_at,
       created_at,
       updated_at,
       creator_id,
       'legacy:' || id
FROM notifications;

SELECT setval('inbox_messages_id_seq', (SELECT COALESCE(MAX(id), 0) FROM inbox_messages));

INSERT INTO inbox_message_positions (message_id, position_id)
SELECT notification_id, position_id
FROM notification_positions;

INSERT INTO inbox_recipients (message_id, member_id, delivered_at, archived_at)
SELECT nm.notification_id,
       nm.member_id,
       NOW(),
       nd.dismissed_at
FROM notification_members nm
LEFT JOIN notification_dismisses nd
    ON nd.notification_id = nm.notification_id
   AND nd.member_id = nm.member_id;

INSERT INTO inbox_recipients (message_id, member_id, delivered_at, archived_at)
SELECT n.id,
       rm.id,
       NOW(),
       nd.dismissed_at
FROM notifications n
JOIN notification_positions np ON np.notification_id = n.id
JOIN restaurant_member rm ON rm.restaurant_id = n.restaurant_id AND rm.position_id = np.position_id
LEFT JOIN notification_members nm ON nm.notification_id = n.id AND nm.member_id = rm.id
LEFT JOIN notification_dismisses nd ON nd.notification_id = n.id AND nd.member_id = rm.id
WHERE nm.notification_id IS NULL;

DROP TABLE IF EXISTS notification_dismisses;
DROP TABLE IF EXISTS notification_members;
DROP TABLE IF EXISTS notification_positions;
DROP TABLE IF EXISTS notifications;