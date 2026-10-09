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
    expires_at DATE,
    metadata JSONB NOT NULL DEFAULT '{"prior":"kept"}'::jsonb
);
CREATE TABLE inbox_recipients (
    id BIGINT PRIMARY KEY,
    message_id BIGINT REFERENCES inbox_messages(id),
    read_at TIMESTAMPTZ,
    archived_at TIMESTAMPTZ
);
CREATE TABLE position (id BIGINT PRIMARY KEY, name TEXT, is_active BOOLEAN, level TEXT);
CREATE TABLE inbox_message_positions (message_id BIGINT REFERENCES inbox_messages(id), position_id BIGINT REFERENCES position(id));

-- Dates are relative to the restaurant's day, including opposite sides of midnight.
INSERT INTO restaurants VALUES (1, 'Pacific/Kiritimati'), (2, 'America/Adak');
INSERT INTO inbox_messages (id, restaurant_id, type, expires_at)
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

-- Include a legacy message whose receipt rows were removed before history became permanent.
INSERT INTO inbox_messages (id, restaurant_id, type, expires_at) VALUES (99, 1, 'ANNOUNCEMENT', NULL);
INSERT INTO position VALUES (1, 'Legacy manager', true, 'MANAGER');
INSERT INTO inbox_message_positions SELECT id, 1 FROM inbox_messages WHERE type = 'ANNOUNCEMENT' AND id <> 99;
\ir ../../../main/resources/db/migration/V121__announcement_audience_snapshot.sql

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
        INSERT INTO inbox_messages (id, restaurant_id, type, expires_at) VALUES (100, 1, 'ANNOUNCEMENT', CURRENT_DATE);
        RAISE EXCEPTION 'Database accepted an announcement expiry';
    EXCEPTION WHEN check_violation THEN
        NULL;
    END;
    IF (SELECT count(*) FROM inbox_messages WHERE type = 'ANNOUNCEMENT' AND id <> 99
            AND metadata -> 'announcement' ->> 'audience' = 'POSITIONS'
            AND (metadata -> 'announcement' ->> 'recipientCount')::int = 1
            AND metadata -> 'announcement' -> 'recipients' = '[]'::jsonb
            AND metadata -> 'announcement' -> 'positions' -> 0 ->> 'name' = 'Legacy manager'
            AND metadata ->> 'prior' = 'kept') <> 8 THEN
        RAISE EXCEPTION 'Legacy audience or receipt count was not saved';
    END IF;
    IF (SELECT metadata -> 'announcement' -> 'positions' FROM inbox_messages WHERE id = 99) <> '[]'::jsonb THEN
        RAISE EXCEPTION 'Missing legacy positions must have an empty snapshot';
    END IF;
    IF (SELECT (metadata -> 'announcement' ->> 'recipientCount')::int FROM inbox_messages WHERE id = 99) <> 0 THEN
        RAISE EXCEPTION 'Missing legacy receipts must be counted as zero';
    END IF;
    IF EXISTS (SELECT 1 FROM inbox_messages WHERE type <> 'ANNOUNCEMENT'
            AND metadata <> '{"prior":"kept"}'::jsonb) THEN
        RAISE EXCEPTION 'Other message metadata changed';
    END IF;
END $$;
ROLLBACK;
