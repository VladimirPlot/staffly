package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.PositionChangeImpactPlan;
import ru.staffly.member.lifecycle.PositionChangeCoordinator;

/** Application facade; schedule opportunities and impacts are interpreted by the schedule module. */
@Service
@RequiredArgsConstructor
public class PositionChangeImpactService {
    private final PositionChangeCoordinator coordinator;

    public PositionChangeImpactPlan calculate(Long restaurantId, Long memberId, Long targetPositionId,
            Long actorUserId) {
        return coordinator.preview(restaurantId, memberId, targetPositionId, actorUserId);
    }
}
