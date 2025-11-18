CREATE TABLE IF NOT EXISTS income_periods (
    id          BIGSERIAL PRIMARY KEY,
    user_id     BIGINT      NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    name        VARCHAR(255) NOT NULL,
    description TEXT,
    created_at  TIMESTAMP   NOT NULL DEFAULT NOW(),
    updated_at  TIMESTAMP   NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_periods_user ON income_periods(user_id);

CREATE TABLE IF NOT EXISTS income_shifts (
    id                BIGSERIAL PRIMARY KEY,
    period_id         BIGINT       NOT NULL REFERENCES income_periods(id) ON DELETE CASCADE,
    user_id           BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    date              DATE         NOT NULL,
    type              VARCHAR(32)  NOT NULL,
    fixed_amount      NUMERIC(16,2),
    start_time        TIME,
    end_time          TIME,
    hourly_rate       NUMERIC(16,2),
    tips_amount       NUMERIC(16,2),
    personal_revenue  NUMERIC(16,2),
    comment           TEXT,
    created_at        TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at        TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_income_shifts_period ON income_shifts(period_id);
CREATE INDEX IF NOT EXISTS idx_income_shifts_user ON income_shifts(user_id);

CREATE TABLE IF NOT EXISTS personal_notes (
    id         BIGSERIAL PRIMARY KEY,
    user_id    BIGINT       NOT NULL REFERENCES users(id) ON DELETE CASCADE,
    title      VARCHAR(255),
    content    TEXT,
    created_at TIMESTAMP    NOT NULL DEFAULT NOW(),
    updated_at TIMESTAMP    NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_personal_notes_user ON personal_notes(user_id);