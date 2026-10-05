package ru.staffly.training.lifecycle;
import ru.staffly.member.lifecycle.*;
public record CertificationTerminationResult(boolean audienceReconciled) implements TerminationModuleResult {
 @Override public LifecycleModule module(){return LifecycleModule.CERTIFICATION;}
}
