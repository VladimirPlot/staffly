-- Legacy pending plans already changed schedules at creation and have no trusted Position snapshot.
-- Require a new authorized plan; do not invent historical snapshots or undo production schedules.
ALTER TABLE invitation DROP CONSTRAINT chk_invitation_status;
ALTER TABLE invitation ADD CONSTRAINT chk_invitation_status CHECK
    (status IN ('PENDING','ACCEPTED','DECLINED','EXPIRED','CANCELED','INVALIDATED','SUPERSEDED'));
UPDATE invitation SET status = CASE WHEN expires_at <= now() THEN 'EXPIRED' ELSE 'INVALIDATED' END
WHERE status = 'PENDING';
ALTER TABLE invitation ADD COLUMN position_snapshot JSONB;
ALTER TABLE invitation ADD COLUMN accepted_member_id BIGINT REFERENCES restaurant_member(id);
COMMENT ON COLUMN invitation.desired_role IS 'Legacy display snapshot only; admission authority is position_snapshot';
UPDATE invitation SET phone_or_email = CASE
    WHEN position('@' in phone_or_email) > 0 THEN lower(trim(phone_or_email))
    ELSE '+' || regexp_replace(phone_or_email, '[^0-9]', '', 'g') END;
ALTER TABLE invitation ADD CONSTRAINT chk_invitation_pending_position_snapshot
    CHECK (status <> 'PENDING' OR position_snapshot IS NOT NULL);
-- Existing uq_invitation_pending_restaurant_contact partial index remains the DB invariant.
ALTER TABLE invitation_schedule_intent DROP CONSTRAINT chk_invitation_schedule_intent_action;
ALTER TABLE invitation_schedule_intent ADD CONSTRAINT chk_invitation_schedule_intent_action CHECK
    (selected_action IN ('ADD_TO_COLLECTION','DO_NOT_ADD','ADD_AND_REOPEN_COLLECTION',
                        'ADD_AND_REOPEN_FOR_REBUILD','ADD_TO_DRAFT','DO_NOT_ADD_TO_DRAFT','INFORMATION_ONLY'));
