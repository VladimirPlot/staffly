package ru.staffly.training.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.LifecycleModule;
import ru.staffly.training.service.CertificationAudienceSyncService;

/** Adapter keeping employee lifecycle callers independent of certification assignment internals. */
@Component
@RequiredArgsConstructor
public class CertificationEmployeeLifecycleHandler implements Ordered {
    private final CertificationAudienceSyncService audienceSync;

    public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 200; }
    public CertificationLifecycleImpact previewTermination() { return new CertificationLifecycleImpact(true); }
    public CertificationLifecycleImpact previewPositionChange() { return new CertificationLifecycleImpact(true); }
    public CertificationTerminationResult applyTermination(Long restaurantId) {
        audienceSync.syncRestaurantAudience(restaurantId);
        return new CertificationTerminationResult(true);
    }
    public CertificationPositionChangeResult applyPositionChange(Long restaurantId, Long subjectUserId) {
        return new CertificationPositionChangeResult(audienceSync.syncRestaurantAudience(restaurantId, subjectUserId));
    }
}
