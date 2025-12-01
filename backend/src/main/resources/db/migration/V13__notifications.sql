CREATE TABLE IF NOT EXISTS notifications (
    id             BIGSERIAL PRIMARY KEY,
    restaurant_id  BIGINT       NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    creator_id     BIGINT       NOT NULL REFERENCES users(id),
    content        TEXT         NOT NULL,
    expires_at     DATE         NOT NULL,
    created_at     TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at     TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_notifications_restaurant ON notifications(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_notifications_expires ON notifications(expires_at);
CREATE INDEX IF NOT EXISTS idx_notifications_restaurant_expires ON notifications(restaurant_id, expires_at);

CREATE TABLE IF NOT EXISTS notification_positions (
    notification_id BIGINT NOT NULL REFERENCES notifications(id) ON DELETE CASCADE,
    position_id     BIGINT NOT NULL REFERENCES position(id),
    PRIMARY KEY (notification_id, position_id)
);

CREATE INDEX IF NOT EXISTS idx_notification_positions_position ON notification_positions(position_id);