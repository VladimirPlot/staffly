package ru.staffly.training.lifecycle;
import java.util.List;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.OwnershipTransfer;
import ru.staffly.member.lifecycle.*;
public record CertificationTerminationDecision(List<OwnershipTransfer> ownershipTransfers)
        implements TerminationModuleDecision {
    public CertificationTerminationDecision { ownershipTransfers = List.copyOf(ownershipTransfers); }
    @Override public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
}
