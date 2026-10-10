-- A membership may retain old position history alongside its current operational row.
ALTER TABLE schedule_row DROP CONSTRAINT uq_schedule_row_schedule_member;
CREATE UNIQUE INDEX uq_schedule_row_active_member ON schedule_row(schedule_id, member_id)
    WHERE historical = FALSE AND member_id IS NOT NULL;
