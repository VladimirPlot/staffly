package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest;
import ru.staffly.member.dto.ApplyEmployeeRemovalResult;
import ru.staffly.member.lifecycle.TerminateMembershipCoordinator;

/** API-compatible facade; transaction and orchestration are owned by the lifecycle coordinator. */
@Service
@RequiredArgsConstructor
public class EmployeeRemovalApplyService {
    private final TerminateMembershipCoordinator coordinator;

    public ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
            ApplyEmployeeRemovalRequest request, Long actorUserId) {
        return coordinator.apply(restaurantId, memberId, request, actorUserId);
    }
}
