package ru.staffly.invite.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;

@Slf4j
@Component
@RequiredArgsConstructor
public class InvitationCleanupJob {
    private final InvitationRepository invitations;

    // Каждые 60 минут (в начале часа)
    @Scheduled(cron = "0 0 * * * *")
    @Transactional
    public void materializeExpiredPending() {
        int expired = invitations.expirePendingAtOrBefore(
                InvitationStatus.PENDING, InvitationStatus.EXPIRED, TimeProvider.now());
        if (expired > 0) {
            log.info("Materialized {} expired pending invitations", expired);
        }
    }
}
