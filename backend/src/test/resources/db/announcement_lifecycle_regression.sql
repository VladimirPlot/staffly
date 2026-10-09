-- Run with psql -v ON_ERROR_STOP=1 -f this-file.sql against an isolated test database.
-- The fixture and migration run in a private schema and are rolled back afterwards.
BEGIN;
CREATE SCHEMA announcement_lifecycle_regression;
SET LOCAL search_path TO announcement_lifecycle_regression;

CREATE TABLE restaurants (id BIGINT PRIMARY KEY, timezone TEXT NOT NULL);
CREATE TABLE inbox_messages (
    id BIGINT PRIMARY KEY,
    restaurant_id BIGINT REFERENCES restaurants(id),
    type TEXT NOT NULL,
    expires_at DATE
);
CREATE TABLE inbox_recipients (
    id BIGINT PRIMARY KEY,
    message_id BIGINT REFERENCES inbox_messages(id),
    read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);

-- Dates are relative to the restaurant's day, including opposite sides of midnight.
INSERT INTO restaurants VALUES (1, 'Pacific/Kiritimati'), (2, 'America/Adak');
INSERT INTO inbox_messages
SELECT id * 10 + 1, id, 'ANNOUNCEMENT', (now() AT TIME ZONE timezone)::date - 1 FROM restaurants
UNION ALL
SELECT id * 10 + 2, id, 'ANNOUNCEMENT', (now() AT TIME ZONE timezone)::date FROM restaurants
UNION ALL
SELECT id * 10 + 3, id, 'ANNOUNCEMENT', (now() AT TIME ZONE timezone)::date + 10 FROM restaurants
UNION ALL
SELECT id * 10 + 4, id, 'ANNOUNCEMENT', NULL FROM restaurants
UNION ALL
SELECT id * 10 + 5, id, 'EVENT', DATE '2020-01-01' FROM restaurants
UNION ALL
SELECT id * 10 + 6, id, 'BIRTHDAY', DATE '2020-01-01' FROM restaurants;

INSERT INTO inbox_recipients
SELECT id, id,
       CASE WHEN id % 10 = 1 THEN TIMESTAMPTZ '2020-01-02 00:00:00Z' END,
       CASE WHEN id % 10 = 3 THEN TIMESTAMPTZ '2020-01-03 00:00:00Z' END
FROM inbox_messages;

\ir ../../../main/resources/db/migration/V120__announcement_message_lifecycle.sql

DO $$
BEGIN
    IF EXISTS (SELECT 1 FROM inbox_messages WHERE type = 'ANNOUNCEMENT' AND expires_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Announcement expiry was not removed';
    END IF;
    IF (SELECT count(*) FROM inbox_recipients WHERE id % 10 = 1 AND archived_at IS NOT NULL
            AND read_at = TIMESTAMPTZ '2020-01-02 00:00:00Z') <> 2 THEN
        RAISE EXCEPTION 'Expired messages must stay hidden without changing read state';
    END IF;
    IF EXISTS (SELECT 1 FROM inbox_recipients WHERE id % 10 IN (2, 4, 5, 6) AND archived_at IS NOT NULL) THEN
        RAISE EXCEPTION 'Active messages or other types were archived';
    END IF;
    IF (SELECT count(*) FROM inbox_recipients WHERE id % 10 = 3
            AND archived_at = TIMESTAMPTZ '2020-01-03 00:00:00Z') <> 2 THEN
        RAISE EXCEPTION 'Explicitly hidden state changed';
    END IF;
    IF (SELECT count(*) FROM inbox_messages WHERE type IN ('EVENT', 'BIRTHDAY')
            AND expires_at = DATE '2020-01-01') <> 4 THEN
        RAISE EXCEPTION 'Expiry for other message types changed';
    END IF;
    BEGIN
        INSERT INTO inbox_messages VALUES (100, 1, 'ANNOUNCEMENT', CURRENT_DATE);
        RAISE EXCEPTION 'Database accepted an announcement expiry';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
END $$;
ROLLBACK;
