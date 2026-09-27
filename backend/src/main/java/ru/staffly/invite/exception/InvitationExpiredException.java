package ru.staffly.invite.exception;

import ru.staffly.common.exception.BadRequestException;

/** A committed terminal invitation outcome, not a rolled-back acceptance failure. */
public class InvitationExpiredException extends BadRequestException {
    public static final String ERROR_CODE = "INVITATION_EXPIRED";

    public InvitationExpiredException() {
        super("Срок действия приглашения истёк");
    }
}
