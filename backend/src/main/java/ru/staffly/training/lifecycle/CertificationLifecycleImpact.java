package ru.staffly.training.lifecycle;
import ru.staffly.member.lifecycle.*;
public record CertificationLifecycleImpact(LifecycleModule module, boolean audienceWillBeReconciled)
 implements TerminationModuleImpact, PositionChangeModuleImpact { }
