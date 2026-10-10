ALTER TABLE auth_sessions
    ADD COLUMN restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE SET NULL;
