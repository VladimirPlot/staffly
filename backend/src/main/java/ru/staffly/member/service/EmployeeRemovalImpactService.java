package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;
import ru.staffly.member.lifecycle.TerminationLifecycleHandler;

/** Application facade; schedule state interpretation belongs to the schedule lifecycle adapter. */
@Service
@RequiredArgsConstructor
public class EmployeeRemovalImpactService {
    private final TerminationLifecycleHandler scheduleLifecycle;

    public EmployeeRemovalImpactPlan calculate(Long restaurantId, Long memberId, Long actorUserId) {
        return scheduleLifecycle.preview(restaurantId, memberId, actorUserId);
    }
}
