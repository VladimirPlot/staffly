package ru.staffly.invite.exception;

import ru.staffly.common.exception.ConflictException;

import java.util.Map;

/** A committed terminal outcome, rather than a failed acceptance transaction. */
public class InvitationInvalidatedException extends ConflictException {
    public static final String ERROR_CODE = "INVITATION_INVALIDATED";
    public static final String MESSAGE = "Не удалось принять приглашение. Условия приглашения изменились. Попросите руководителя отправить новое приглашение.";

    public InvitationInvalidatedException(String reason) {
        super(MESSAGE, Map.of("code", ERROR_CODE, "reason", reason));
    }
}
