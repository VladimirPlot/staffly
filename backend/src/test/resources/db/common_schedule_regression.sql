-- Replace the marker with V134__common_schedules.sql before piping to psql.
-- Everything, including the isolated schema, is rolled back.
BEGIN;
CREATE SCHEMA staffly_common_schedule_regression;
SET LOCAL search_path TO staffly_common_schedule_regression;
CREATE TABLE restaurants (id BIGINT PRIMARY KEY);
CREATE TABLE schedule (id BIGINT PRIMARY KEY, restaurant_id BIGINT REFERENCES restaurants(id) ON DELETE CASCADE);

-- APPLY V134 HERE

INSERT INTO restaurants VALUES (1);
INSERT INTO schedule VALUES (10, 1), (20, 1), (30, 1);
INSERT INTO common_schedule (id, restaurant_id, title) VALUES (1, 1, 'Общий');
INSERT INTO common_schedule_source VALUES (1, 10, 0), (1, 20, 1), (1, 30, 2);
SET CONSTRAINTS ALL IMMEDIATE;

DO $$
BEGIN
    BEGIN
        DELETE FROM schedule WHERE id = 10;
        RAISE EXCEPTION 'Source deletion should be blocked';
    EXCEPTION WHEN foreign_key_violation THEN NULL;
    END;
END $$;

-- Hibernate may update the schedule id at each existing order index.
SET CONSTRAINTS ALL DEFERRED;
UPDATE common_schedule_source SET schedule_id = 30 WHERE source_order = 0;
UPDATE common_schedule_source SET schedule_id = 10 WHERE source_order = 1;
UPDATE common_schedule_source SET schedule_id = 20 WHERE source_order = 2;
SET CONSTRAINTS ALL IMMEDIATE;
DO $$
BEGIN
    IF (SELECT array_agg(schedule_id ORDER BY source_order) FROM common_schedule_source) != ARRAY[30,10,20]::BIGINT[] THEN
        RAISE EXCEPTION 'Source order was lost';
    END IF;
    BEGIN
        INSERT INTO common_schedule_source VALUES (1, 30, 3);
        RAISE EXCEPTION 'Duplicate source should be blocked';
    EXCEPTION WHEN unique_violation THEN NULL;
    END;
END $$;

DELETE FROM common_schedule WHERE id = 1;
DO $$
BEGIN
    IF (SELECT count(*) FROM schedule) != 3 OR (SELECT count(*) FROM common_schedule_source) != 0 THEN
        RAISE EXCEPTION 'Deleting a common schedule must only delete its links';
    END IF;
END $$;

-- Restaurant removal must not be blocked by links being cascaded in the same statement.
INSERT INTO common_schedule (id, restaurant_id, title) VALUES (2, 1, 'Общий');
INSERT INTO common_schedule_source VALUES (2, 10, 0), (2, 20, 1);
SET CONSTRAINTS ALL DEFERRED;
DELETE FROM restaurants WHERE id = 1;
SET CONSTRAINTS ALL IMMEDIATE;
DO $$
BEGIN
    IF (SELECT count(*) FROM common_schedule) != 0 OR (SELECT count(*) FROM common_schedule_source) != 0 THEN
        RAISE EXCEPTION 'Restaurant cascade left common schedules or links';
    END IF;
END $$;
ROLLBACK;
