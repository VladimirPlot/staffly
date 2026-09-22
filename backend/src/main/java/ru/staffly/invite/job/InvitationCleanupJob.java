package ru.staffly.invite.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.invite.service.InvitationExpiryService;

@Slf4j
@Component
@RequiredArgsConstructor
public class InvitationCleanupJob {
    private final InvitationExpiryService expiryService;

    // Каждые 60 минут (в начале часа)
    @Scheduled(cron = "0 0 * * * *")
    public void materializeExpiredPending() {
        int candidatesScanned = 0;
        int invitationsExpired = 0;
        InvitationExpiryService.BatchResult batch;
        do {
            batch = expiryService.expireNextBatch(TimeProvider.now());
            candidatesScanned += batch.candidateCount();
            invitationsExpired += batch.expiredCount();
        } while (batch.candidateCount() == InvitationExpiryService.BATCH_SIZE);
        if (candidatesScanned > 0) {
            log.info("Processed {} expired invitation candidates; materialized {} expirations",
                    candidatesScanned, invitationsExpired);
        }
    }
}
