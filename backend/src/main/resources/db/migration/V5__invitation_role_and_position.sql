ALTER TABLE invitation
  ADD COLUMN desired_role VARCHAR(20) NOT NULL DEFAULT 'STAFF',
  ADD CONSTRAINT chk_invitation_desired_role
    CHECK (desired_role IN ('ADMIN','MANAGER','STAFF'));

ALTER TABLE invitation
  ADD COLUMN position_id BIGINT NULL
    REFERENCES position(id) ON DELETE SET NULL;