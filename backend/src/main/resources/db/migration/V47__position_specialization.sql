ALTER TABLE position
    ADD COLUMN specialization VARCHAR(40);

ALTER TABLE position
    ADD CONSTRAINT chk_position_specialization
        CHECK (specialization IS NULL OR specialization IN ('EXAMINER'));

CREATE INDEX IF NOT EXISTS idx_position_restaurant_specialization
    ON position (restaurant_id, specialization);