CREATE TABLE schedule_build_position_config_heavy_day (
    position_config_id BIGINT NOT NULL,
    day_of_week INTEGER NOT NULL,
    sort_order INTEGER NOT NULL DEFAULT 0,
    CONSTRAINT pk_sbpc_heavy_day PRIMARY KEY (position_config_id, sort_order),
    CONSTRAINT uq_sbpc_heavy_day UNIQUE (position_config_id, day_of_week),
    CONSTRAINT fk_sbpc_heavy_day_config FOREIGN KEY (position_config_id) REFERENCES schedule_build_position_config(id) ON DELETE CASCADE,
    CONSTRAINT chk_sbpc_heavy_day_day CHECK (day_of_week BETWEEN 1 AND 7)
);

CREATE INDEX idx_sbpc_heavy_day_config ON schedule_build_position_config_heavy_day(position_config_id);
