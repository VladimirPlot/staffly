package ru.staffly.training.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;
import ru.staffly.training.service.CertificationAudienceSyncService;

/** Certification is a peer lifecycle participant; it never depends on Schedule. */
@Component
@RequiredArgsConstructor
public class CertificationEmployeeLifecycleHandler
        implements TerminationLifecycleHandler, PositionChangeLifecycleHandler {
    private final CertificationAudienceSyncService audienceSync;
    @Override public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 200; }
    @Override public CertificationLifecycleImpact preview(TerminationPreviewContext context) {
        return new CertificationLifecycleImpact(module(), true);
    }
    @Override public CertificationLifecycleImpact preview(PositionChangePreviewContext context) {
        return new CertificationLifecycleImpact(module(), true);
    }
    @Override public CertificationTerminationResult applyAfterTermination(TerminationApplyContext context,
            TerminationModuleDecision decision, TerminationModuleResult beforeResult) {
        audienceSync.syncRestaurantAudience(context.restaurantId());
        return new CertificationTerminationResult(true);
    }
    @Override public CertificationPositionChangeResult applyAfterPositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision, PositionChangeModulePreparation preparation) {
        return new CertificationPositionChangeResult(
                audienceSync.syncRestaurantAudience(context.restaurantId(), context.member().getUser().getId()));
    }
}
