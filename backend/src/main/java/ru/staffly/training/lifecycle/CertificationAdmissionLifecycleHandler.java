package ru.staffly.training.lifecycle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.training.service.TrainingExamOwnershipService;
import java.util.List;
@Component
@RequiredArgsConstructor
public class CertificationAdmissionLifecycleHandler implements AdmissionLifecycleHandler {
    private final CertificationAudienceSyncService audience;
    private final TrainingExamOwnershipService ownership;
    @Override public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
    @Override public int getOrder() { return 200; }
    @Override public PreparedAdmission prepare(AdmissionApplyContext c) {
        ownership.lockActiveCertificationExams(c.restaurantId());
        return member -> new AdmissionModuleResult(c.operationId(), List.of(),
                audience.syncRestaurantAudience(c.restaurantId(), c.user().getId(), false));
    }
}
