package ru.staffly.invite.job;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Component;
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
    public void purgeExpiredPending() {
        int deleted = invitations.deleteByStatusAndExpiresAtBefore(InvitationStatus.PENDING, TimeProvider.now());
        if (deleted > 0) {
            log.info("Purged {} expired pending invitations", deleted);
        }
    }
}
