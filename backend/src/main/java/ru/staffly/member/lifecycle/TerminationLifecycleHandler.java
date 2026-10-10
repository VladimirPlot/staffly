package ru.staffly.member.lifecycle;

import org.springframework.core.Ordered;

/** Operation-specific module protocol. Apply hooks run in the coordinator transaction. */
public interface TerminationLifecycleHandler extends Ordered {
    LifecycleModule module();
    TerminationModuleImpact preview(TerminationPreviewContext context);
    default TerminationModuleResult applyBeforeTermination(TerminationApplyContext context,
                                                            TerminationModuleDecision decision) { return null; }
    default TerminationModuleResult applyAfterTermination(TerminationApplyContext context,
                                                           TerminationModuleDecision decision,
                                                           TerminationModuleResult beforeResult) { return beforeResult; }
}
