package ru.staffly.training.dto;

public record AppliedCertificationAudienceEffect(
        Long certificationId,
        String certificationTitle,
        Long ownerUserId,
        Long userId,
        CertificationAudienceEffectType effectType
) {
    public boolean becameEffective() {
        return effectType == CertificationAudienceEffectType.CREATED
                || effectType == CertificationAudienceEffectType.REACTIVATED;
    }
}
