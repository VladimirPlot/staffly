package ru.staffly.training.lifecycle;
import java.util.List;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.OwnershipTransfer;
public record CertificationPositionChangeDecision(List<OwnershipTransfer> transfers,
        List<ru.staffly.member.dto.PositionChangeImpactPlan.OwnershipState> expectedOwnershipState) implements PositionChangeModuleDecision {
    public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
}
