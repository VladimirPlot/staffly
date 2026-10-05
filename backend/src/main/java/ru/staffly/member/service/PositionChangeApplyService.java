package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.ApplyPositionChangeRequest;
import ru.staffly.member.dto.ApplyPositionChangeResult;
import ru.staffly.member.lifecycle.PositionChangeLifecycleHandler;

/** Transactional lifecycle facade. The adapter owns schedule locking and semantic validation. */
@Service
@RequiredArgsConstructor
public class PositionChangeApplyService {
    private final PositionChangeLifecycleHandler scheduleLifecycle;

    public ApplyPositionChangeResult apply(Long restaurantId, Long memberId,
            ApplyPositionChangeRequest request, Long actorUserId) {
        return scheduleLifecycle.apply(restaurantId, memberId, request, actorUserId);
    }
}
