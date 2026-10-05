package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.PositionChangeImpactPlan;
import ru.staffly.member.lifecycle.PositionChangeLifecycleHandler;

/** Application facade; schedule opportunities and impacts are interpreted by the schedule module. */
@Service
@RequiredArgsConstructor
public class PositionChangeImpactService {
    private final PositionChangeLifecycleHandler scheduleLifecycle;

    public PositionChangeImpactPlan calculate(Long restaurantId, Long memberId, Long targetPositionId,
            Long actorUserId) {
        return scheduleLifecycle.preview(restaurantId, memberId, targetPositionId, actorUserId);
    }
}
