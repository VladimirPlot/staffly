package ru.staffly.training.dto;

/** A certification ownership change that has been validated and persisted in the current transaction. */
public record AppliedCertificationOwnershipTransfer(
        Long certificationId,
        String title,
        Long newOwnerUserId
) {
}
