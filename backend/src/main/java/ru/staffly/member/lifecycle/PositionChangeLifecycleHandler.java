package ru.staffly.member.lifecycle;

import org.springframework.core.Ordered;
import ru.staffly.member.dto.ApplyPositionChangeRequest;
import ru.staffly.member.dto.ApplyPositionChangeResult;
import ru.staffly.member.dto.PositionChangeImpactPlan;

/** Position-change contract is deliberately separate from termination. */
public interface PositionChangeLifecycleHandler extends Ordered {
    LifecycleModule module();
    PositionChangeImpactPlan preview(Long restaurantId, Long memberId, Long targetPositionId, Long actorUserId);
    ApplyPositionChangeResult apply(Long restaurantId, Long memberId,
                                    ApplyPositionChangeRequest decision, Long actorUserId);
}
