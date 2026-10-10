package ru.staffly.training.lifecycle;
import java.util.List;
import ru.staffly.member.lifecycle.*;
import ru.staffly.training.dto.AppliedCertificationOwnershipTransfer;
public record CertificationPositionChangePreparation(List<AppliedCertificationOwnershipTransfer> transfers) implements PositionChangeModulePreparation {
    public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
}
