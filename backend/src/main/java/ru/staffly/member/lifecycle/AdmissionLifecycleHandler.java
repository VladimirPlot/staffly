package ru.staffly.member.lifecycle;
import org.springframework.core.Ordered;
import ru.staffly.member.model.RestaurantMember;
/** prepare must only lock and validate. apply runs after all modules prepared, in the same transaction. */
public interface AdmissionLifecycleHandler extends Ordered {
    PreparedAdmission prepare(AdmissionApplyContext context);
    interface PreparedAdmission {
        AdmissionModuleResult applyAfterMembershipCreated(RestaurantMember member);
    }
}
