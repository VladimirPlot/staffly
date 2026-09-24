CREATE TABLE schedule_preference_shift_option_snapshot_day (
    snapshot_id BIGINT NOT NULL,
    day_of_week VARCHAR(9) NOT NULL,
    CONSTRAINT pk_spsos_day PRIMARY KEY (snapshot_id, day_of_week),
    CONSTRAINT fk_spsos_day_snapshot FOREIGN KEY (snapshot_id)
        REFERENCES schedule_preference_shift_option_snapshot(id) ON DELETE CASCADE,
    CONSTRAINT ck_spsos_day_value CHECK (day_of_week IN
        ('MONDAY','TUESDAY','WEDNESDAY','THURSDAY','FRIDAY','SATURDAY','SUNDAY'))
);

-- Every pre-regime snapshot represented one effective vocabulary for the whole week.
INSERT INTO schedule_preference_shift_option_snapshot_day (snapshot_id, day_of_week)
SELECT snapshot.id, weekday.day_of_week
FROM schedule_preference_shift_option_snapshot snapshot
CROSS JOIN (VALUES ('MONDAY'), ('TUESDAY'), ('WEDNESDAY'), ('THURSDAY'),
                   ('FRIDAY'), ('SATURDAY'), ('SUNDAY')) AS weekday(day_of_week);
