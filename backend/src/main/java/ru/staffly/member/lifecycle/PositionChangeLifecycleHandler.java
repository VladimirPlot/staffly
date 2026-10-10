package ru.staffly.member.lifecycle;

import org.springframework.core.Ordered;

/** Two apply stages preserve old-position cleanup -> mutation -> new-position consequences. */
public interface PositionChangeLifecycleHandler extends Ordered {
    LifecycleModule module();
    PositionChangeModuleImpact preview(PositionChangePreviewContext context);
    default PositionChangeModulePreparation applyBeforePositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision) { return null; }
    default PositionChangeModuleResult applyAfterPositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision, PositionChangeModulePreparation preparation) { return null; }
}
