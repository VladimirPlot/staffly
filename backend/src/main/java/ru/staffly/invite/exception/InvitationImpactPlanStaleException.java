package ru.staffly.invite.exception;

import ru.staffly.common.exception.ConflictException;

import java.util.Map;

public class InvitationImpactPlanStaleException extends ConflictException {
    public static final String ERROR_CODE = "INVITATION_IMPACT_PLAN_STALE";

    public InvitationImpactPlanStaleException() {
        super("Invitation impact plan is stale; refresh it before sending the invitation",
                Map.of("code", ERROR_CODE));
    }
}
