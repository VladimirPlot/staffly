package ru.staffly.training.lifecycle;
import java.util.List;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.OwnershipResource;
import ru.staffly.member.dto.PositionChangeImpactPlan.OwnershipState;
public record CertificationPositionChangeImpact(boolean audienceWillBeReconciled, List<OwnershipResource> ownership,
                                               List<OwnershipState> ownershipState,
        List<ru.staffly.member.dto.PositionChangeImpactPlan.CertificationAudienceChange> audienceChanges) implements PositionChangeModuleImpact {
    public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
}
