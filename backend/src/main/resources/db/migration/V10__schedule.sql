CREATE TABLE IF NOT EXISTS schedule (
    id              BIGSERIAL PRIMARY KEY,
    restaurant_id   BIGINT       NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
    title           VARCHAR(255) NOT NULL,
    start_date      DATE         NOT NULL,
    end_date        DATE         NOT NULL,
    shift_mode      VARCHAR(32)  NOT NULL,
    show_full_name  BOOLEAN      NOT NULL DEFAULT FALSE,
    position_ids    TEXT         NULL,
    created_at      TIMESTAMPTZ  NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ  NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_restaurant ON schedule(restaurant_id);
CREATE UNIQUE INDEX IF NOT EXISTS uq_schedule_restaurant_title ON schedule(restaurant_id, title);

CREATE TABLE IF NOT EXISTS schedule_row (
    id             BIGSERIAL PRIMARY KEY,
    schedule_id    BIGINT       NOT NULL REFERENCES schedule(id) ON DELETE CASCADE,
    member_id      BIGINT       NULL REFERENCES restaurant_member(id) ON DELETE SET NULL,
    display_name   VARCHAR(255) NOT NULL,
    position_id    BIGINT       NULL REFERENCES position(id) ON DELETE SET NULL,
    position_name  VARCHAR(150) NULL,
    sort_order     INTEGER      NOT NULL DEFAULT 0
);
CREATE INDEX IF NOT EXISTS idx_schedule_row_schedule ON schedule_row(schedule_id);

CREATE TABLE IF NOT EXISTS schedule_cell (
    id         BIGSERIAL PRIMARY KEY,
    row_id     BIGINT      NOT NULL REFERENCES schedule_row(id) ON DELETE CASCADE,
    day        DATE        NOT NULL,
    value      TEXT        NOT NULL,
    UNIQUE (row_id, day)
);
CREATE INDEX IF NOT EXISTS idx_schedule_cell_row ON schedule_cell(row_id);