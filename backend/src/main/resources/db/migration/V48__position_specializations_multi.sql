CREATE TABLE IF NOT EXISTS position_specialization (
    position_id BIGINT NOT NULL,
    specialization VARCHAR(40) NOT NULL,
    PRIMARY KEY (position_id, specialization),
    CONSTRAINT fk_position_specialization_position
        FOREIGN KEY (position_id)
            REFERENCES position (id)
            ON DELETE CASCADE,
    CONSTRAINT chk_position_specialization_value
        CHECK (specialization IN ('EXAMINER'))
);

INSERT INTO position_specialization (position_id, specialization)
SELECT id, specialization
FROM position
WHERE specialization IS NOT NULL
ON CONFLICT DO NOTHING;

DROP INDEX IF EXISTS idx_position_restaurant_specialization;
ALTER TABLE position DROP CONSTRAINT IF EXISTS chk_position_specialization;
ALTER TABLE position DROP COLUMN IF EXISTS specialization;

CREATE INDEX IF NOT EXISTS idx_position_specialization_specialization
    ON position_specialization (specialization);
