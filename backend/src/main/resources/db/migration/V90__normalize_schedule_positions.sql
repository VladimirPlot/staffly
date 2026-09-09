CREATE TABLE schedule_position (
    schedule_id BIGINT NOT NULL,
    position_id BIGINT NOT NULL,
    CONSTRAINT uq_schedule_position_schedule_position UNIQUE (schedule_id, position_id),
    CONSTRAINT fk_schedule_position_schedule
        FOREIGN KEY (schedule_id) REFERENCES schedule (id) ON DELETE CASCADE,
    CONSTRAINT fk_schedule_position_position
        FOREIGN KEY (position_id) REFERENCES position (id)
);

CREATE INDEX idx_schedule_position_position_id ON schedule_position (position_id);

-- Alpha data is disposable. Reset the Schedule domain rather than retain schedules with
-- an empty relation or add a transitional parser for the legacy serialized TEXT values.
-- Existing ON DELETE CASCADE constraints remove rows/cells, preference submissions,
-- shift requests, and audit records belonging to these schedules.
DELETE FROM schedule;

ALTER TABLE schedule DROP COLUMN position_ids;
