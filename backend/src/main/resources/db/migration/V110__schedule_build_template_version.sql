ALTER TABLE schedule_build_template
    ADD COLUMN version BIGINT NOT NULL DEFAULT 0;

ALTER TABLE schedule_build_template
    ALTER COLUMN version DROP DEFAULT;
