package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest;
import ru.staffly.member.dto.ApplyEmployeeRemovalResult;
import ru.staffly.member.lifecycle.TerminationLifecycleHandler;

/** Transactional lifecycle facade. The adapter owns schedule locking and semantic validation. */
@Service
@RequiredArgsConstructor
public class EmployeeRemovalApplyService {
    private final TerminationLifecycleHandler scheduleLifecycle;

    public ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
            ApplyEmployeeRemovalRequest request, Long actorUserId) {
        return scheduleLifecycle.apply(restaurantId, memberId, request, actorUserId);
    }
}
