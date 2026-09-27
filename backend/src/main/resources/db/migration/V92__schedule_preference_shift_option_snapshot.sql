CREATE TABLE schedule_preference_shift_option_snapshot (
    id BIGSERIAL PRIMARY KEY,
    schedule_id BIGINT NOT NULL,
    source_shift_option_id BIGINT NOT NULL,
    label VARCHAR(150),
    start_time TIME NOT NULL,
    end_time TIME NOT NULL,
    sort_order INTEGER NOT NULL,
    CONSTRAINT fk_spsos_schedule FOREIGN KEY (schedule_id) REFERENCES schedule(id) ON DELETE CASCADE,
    CONSTRAINT uq_spsos_schedule_source UNIQUE (schedule_id, source_shift_option_id)
);

CREATE INDEX idx_spsos_schedule ON schedule_preference_shift_option_snapshot(schedule_id);

CREATE TABLE schedule_preference_shift_option_snapshot_position (
    snapshot_id BIGINT NOT NULL,
    position_id BIGINT NOT NULL,
    CONSTRAINT pk_spsos_position PRIMARY KEY (snapshot_id, position_id),
    CONSTRAINT fk_spsos_position_snapshot FOREIGN KEY (snapshot_id)
        REFERENCES schedule_preference_shift_option_snapshot(id) ON DELETE CASCADE
);
