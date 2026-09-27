ALTER TABLE invitation DROP CONSTRAINT chk_invitation_status;
ALTER TABLE invitation ADD CONSTRAINT chk_invitation_status
    CHECK (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELED','INVALIDATED'));
