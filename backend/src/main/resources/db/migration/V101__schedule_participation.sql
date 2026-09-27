-- Existing schedules cannot be backfilled without guessing: rows are historical-capable,
-- while non-submitters in preference collection have no persisted evidence. Alpha data is
-- disposable, so reset the aggregate before making participation authoritative.
DELETE FROM schedule;

CREATE TABLE schedule_participation (
    id            BIGSERIAL PRIMARY KEY,
    schedule_id   BIGINT NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    member_id     BIGINT NOT NULL REFERENCES restaurant_member(id) ON DELETE CASCADE,
    position_id   BIGINT NOT NULL,
    position_name VARCHAR(150) NOT NULL,
    CONSTRAINT uq_schedule_participation_schedule_member UNIQUE (schedule_id, member_id)
);

CREATE INDEX idx_schedule_participation_member ON schedule_participation(member_id);
