package ru.staffly.schedule.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;

/** Schedule owns schedule discovery, semantic tokens, locking and state transitions only. */
@Component
@RequiredArgsConstructor
public class ScheduleEmployeeLifecycleHandler implements TerminationLifecycleHandler, PositionChangeLifecycleHandler {
    private final ScheduleTerminationPreviewHandler terminationPreview;
    private final ScheduleTerminationApplyHandler terminationApply;
    private final SchedulePositionChangePreviewHandler positionChangePreview;
    private final SchedulePositionChangeApplyHandler positionChangeApply;

    @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 100; }
    @Override public ScheduleTerminationImpact preview(TerminationPreviewContext context) {
        return terminationPreview.preview(context);
    }
    @Override public ScheduleTerminationResult applyBeforeTermination(TerminationApplyContext context,
            TerminationModuleDecision decision) {
        return terminationApply.apply(context, requireDecision(decision, ScheduleTerminationDecision.class));
    }
    @Override public SchedulePositionChangeImpact preview(PositionChangePreviewContext context) {
        return positionChangePreview.preview(context);
    }
    @Override public SchedulePositionChangePreparation applyBeforePositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision) {
        return positionChangeApply.applyBefore(context, requireDecision(decision, SchedulePositionChangeDecision.class));
    }
    @Override public SchedulePositionChangeResult applyAfterPositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision, PositionChangeModulePreparation preparation) {
        return positionChangeApply.applyAfter(context, requireDecision(decision, SchedulePositionChangeDecision.class),
                requireDecision(preparation, SchedulePositionChangePreparation.class));
    }
    private <T> T requireDecision(Object value, Class<T> type) {
        if (!type.isInstance(value)) throw new IllegalArgumentException("Missing " + module() + " lifecycle decision");
        return type.cast(value);
    }
}
