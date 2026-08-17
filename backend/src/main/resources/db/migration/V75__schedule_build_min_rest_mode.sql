ALTER TABLE schedule_build_position_config
    ADD COLUMN min_rest_mode VARCHAR(10) NOT NULL DEFAULT 'SOFT';

ALTER TABLE schedule_build_position_config
    ADD CONSTRAINT chk_sbpc_min_rest_mode CHECK (min_rest_mode IN ('SOFT', 'STRICT'));
