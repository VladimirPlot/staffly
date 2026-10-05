package ru.staffly.training.lifecycle;
import java.util.List;
import ru.staffly.member.lifecycle.*;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
public record CertificationPositionChangeResult(List<AppliedCertificationAudienceEffect> effects)
 implements PositionChangeModuleResult {
 public CertificationPositionChangeResult { effects=List.copyOf(effects); }
 @Override public LifecycleModule module(){return LifecycleModule.CERTIFICATION;}
}
