package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;
import ru.staffly.member.lifecycle.TerminateMembershipCoordinator;

/** Application facade; schedule state interpretation belongs to the schedule lifecycle adapter. */
@Service
@RequiredArgsConstructor
public class EmployeeRemovalImpactService {
    private final TerminateMembershipCoordinator coordinator;

    public EmployeeRemovalImpactPlan calculate(Long restaurantId, Long memberId, Long actorUserId) {
        return coordinator.preview(restaurantId, memberId, actorUserId);
    }
}
