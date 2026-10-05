package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.ApplyPositionChangeRequest;
import ru.staffly.member.dto.ApplyPositionChangeResult;
import ru.staffly.member.lifecycle.PositionChangeCoordinator;

/** API-compatible facade; transaction and orchestration are owned by the lifecycle coordinator. */
@Service
@RequiredArgsConstructor
public class PositionChangeApplyService {
    private final PositionChangeCoordinator coordinator;

    public ApplyPositionChangeResult apply(Long restaurantId, Long memberId,
            ApplyPositionChangeRequest request, Long actorUserId) {
        return coordinator.apply(restaurantId, memberId, request, actorUserId);
    }
}
