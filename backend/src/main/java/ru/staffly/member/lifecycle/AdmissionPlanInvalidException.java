package ru.staffly.member.lifecycle;
/** Only prepare may signal a domain invalidation; apply failures always roll back. */
public class AdmissionPlanInvalidException extends RuntimeException {
    public AdmissionPlanInvalidException(String reason) { super(reason); }
}
