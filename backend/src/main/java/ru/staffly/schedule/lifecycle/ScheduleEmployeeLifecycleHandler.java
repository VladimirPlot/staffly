package ru.staffly.schedule.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.dto.*;
import ru.staffly.member.lifecycle.*;

/** Schedule-module boundary. The delegates contain the existing state machine unchanged. */
@Component
@RequiredArgsConstructor
public class ScheduleEmployeeLifecycleHandler
        implements TerminationLifecycleHandler, PositionChangeLifecycleHandler {
    private final ScheduleTerminationPreviewHandler terminationPreview;
    private final ScheduleTerminationApplyHandler terminationApply;
    private final SchedulePositionChangePreviewHandler positionChangePreview;
    private final SchedulePositionChangeApplyHandler positionChangeApply;

    @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 100; }
    @Override public EmployeeRemovalImpactPlan preview(Long restaurantId, Long memberId, Long actorUserId) {
        return terminationPreview.calculate(restaurantId, memberId, actorUserId);
    }
    @Override public ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
            ApplyEmployeeRemovalRequest decision, Long actorUserId) {
        return terminationApply.apply(restaurantId, memberId, decision, actorUserId);
    }
    @Override public PositionChangeImpactPlan preview(Long restaurantId, Long memberId,
            Long targetPositionId, Long actorUserId) {
        return positionChangePreview.calculate(restaurantId, memberId, targetPositionId, actorUserId);
    }
    @Override public ApplyPositionChangeResult apply(Long restaurantId, Long memberId,
            ApplyPositionChangeRequest decision, Long actorUserId) {
        return positionChangeApply.apply(restaurantId, memberId, decision, actorUserId);
    }
}
