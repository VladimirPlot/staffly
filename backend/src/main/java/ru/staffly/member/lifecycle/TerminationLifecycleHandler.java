package ru.staffly.member.lifecycle;

import org.springframework.core.Ordered;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest;
import ru.staffly.member.dto.ApplyEmployeeRemovalResult;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;

/** Operation-specific boundary; preview and apply semantics stay owned by the same module. */
public interface TerminationLifecycleHandler extends Ordered {
    LifecycleModule module();
    EmployeeRemovalImpactPlan preview(Long restaurantId, Long memberId, Long actorUserId);
    ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
                                     ApplyEmployeeRemovalRequest decision, Long actorUserId);
}
