package ru.staffly.training.lifecycle;

import java.util.List;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;

public record CertificationPositionChangeResult(List<AppliedCertificationAudienceEffect> effects) {
    public CertificationPositionChangeResult { effects = List.copyOf(effects); }
}
