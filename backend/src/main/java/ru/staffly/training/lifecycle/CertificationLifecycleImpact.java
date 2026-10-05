package ru.staffly.training.lifecycle;
import ru.staffly.member.lifecycle.*;
import java.util.List;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.OwnershipResource;
public record CertificationLifecycleImpact(LifecycleModule module, boolean audienceWillBeReconciled,
                                           List<OwnershipResource> ownership)
        implements TerminationModuleImpact, PositionChangeModuleImpact { }
