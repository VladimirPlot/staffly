package ru.staffly.training.lifecycle;
import java.util.List;
import ru.staffly.training.dto.AppliedCertificationOwnershipTransfer;
import ru.staffly.member.lifecycle.*;
public record CertificationTerminationResult(boolean audienceReconciled,
        List<AppliedCertificationOwnershipTransfer> ownershipTransfers) implements TerminationModuleResult {
 public int ownersTransferred() { return ownershipTransfers.size(); }
 @Override public LifecycleModule module(){return LifecycleModule.CERTIFICATION;}
}
