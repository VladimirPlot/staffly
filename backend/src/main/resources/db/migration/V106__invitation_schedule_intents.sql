CREATE TABLE invitation_schedule_intent (
    id                           BIGSERIAL PRIMARY KEY,
    invitation_id                BIGINT NOT NULL REFERENCES invitation(id) ON DELETE CASCADE,
    schedule_id                  BIGINT NULL REFERENCES schedule(id) ON DELETE SET NULL,
    expected_schedule_id         BIGINT NOT NULL,
    selected_action              VARCHAR(48) NOT NULL,
    requested_deadline           TIMESTAMPTZ NULL,
    expected_schedule_version    BIGINT NOT NULL,
    expected_schedule_status     VARCHAR(32) NOT NULL,
    expected_collection_cycle    BIGINT NOT NULL,
    expected_preference_deadline TIMESTAMPTZ NULL,
    expected_preference_mode     VARCHAR(32) NULL,
    created_at                   TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_invitation_schedule_intent_invitation_schedule UNIQUE (invitation_id, expected_schedule_id),
    CONSTRAINT chk_invitation_schedule_intent_action CHECK (selected_action IN
        ('ADD_TO_COLLECTION', 'DO_NOT_ADD', 'ADD_AND_REOPEN_COLLECTION',
         'ADD_AND_REOPEN_FOR_REBUILD', 'INFORMATION_ONLY')),
    CONSTRAINT chk_invitation_schedule_intent_status CHECK (expected_schedule_status IN
        ('DRAFT', 'COLLECTING_PREFERENCES', 'PREFERENCES_CLOSED', 'DRAFT_FROM_PREFERENCES', 'PUBLISHED')),
    CONSTRAINT chk_invitation_schedule_intent_mode CHECK
        (expected_preference_mode IS NULL OR expected_preference_mode IN ('DAY_LEVEL', 'SHIFT_OPTIONS'))
);

CREATE INDEX idx_invitation_schedule_intent_invitation
    ON invitation_schedule_intent(invitation_id);

CREATE UNIQUE INDEX uq_invitation_pending_restaurant_contact
    ON invitation(restaurant_id, lower(phone_or_email)) WHERE status = 'PENDING';
