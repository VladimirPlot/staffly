CREATE TABLE IF NOT EXISTS push_devices (
    id BIGSERIAL PRIMARY KEY,
    user_id BIGINT NOT NULL REFERENCES users(id),
    endpoint TEXT NOT NULL UNIQUE,
    p256dh TEXT NOT NULL,
    auth TEXT NOT NULL,
    expiration_time BIGINT NULL,
    user_agent TEXT NULL,
    platform TEXT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_seen_at TIMESTAMPTZ NULL,
    disabled_at TIMESTAMPTZ NULL
);

CREATE INDEX IF NOT EXISTS idx_push_devices_user_id ON push_devices(user_id);
CREATE INDEX IF NOT EXISTS idx_push_devices_disabled_at ON push_devices(disabled_at);

CREATE TABLE IF NOT EXISTS push_deliveries (
    id BIGSERIAL PRIMARY KEY,
    ref_type VARCHAR(40) NOT NULL,
    ref_id BIGINT NOT NULL,
    restaurant_id BIGINT NOT NULL REFERENCES restaurants(id),
    user_id BIGINT NOT NULL REFERENCES users(id),
    payload JSONB NOT NULL,
    status VARCHAR(20) NOT NULL,
    run_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    attempts INT NOT NULL DEFAULT 0,
    next_attempt_at TIMESTAMPTZ NULL,
    locked_until TIMESTAMPTZ NULL,
    lock_owner TEXT NULL,
    sent_at TIMESTAMPTZ NULL,
    last_error TEXT NULL,
    last_http_status INT NULL,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_push_delivery_ref UNIQUE (ref_type, ref_id, user_id)
);

CREATE INDEX IF NOT EXISTS idx_push_deliveries_status_run_at ON push_deliveries(status, run_at);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_next_attempt_at ON push_deliveries(next_attempt_at);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_user_id ON push_deliveries(user_id);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_lock_owner ON push_deliveries(lock_owner);
CREATE INDEX IF NOT EXISTS idx_push_deliveries_locked_until ON push_deliveries(locked_until);
