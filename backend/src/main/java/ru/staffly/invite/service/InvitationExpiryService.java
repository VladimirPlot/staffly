package ru.staffly.invite.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inbox.service.BusinessNotificationOperationId;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;

import java.time.Instant;
import java.util.List;

/** Materializes bounded batches of time-driven invitation expirations. */
@Service
@RequiredArgsConstructor
public class InvitationExpiryService {
    public static final int BATCH_SIZE = 100;

    private final InvitationRepository invitations;
    private final InvitationSenderNotificationService senderNotifications;

    @Transactional
    public BatchResult expireNextBatch(Instant now) {
        List<Long> candidateIds = invitations.findExpiredPendingIds(
                InvitationStatus.PENDING, now, PageRequest.of(0, BATCH_SIZE));
        int expiredCount = 0;
        for (Long invitationId : candidateIds) {
            Invitation invitation = invitations.findForUpdateById(invitationId).orElse(null);
            if (invitation == null || invitation.getStatus() != InvitationStatus.PENDING
                    || invitation.getExpiresAt().isAfter(now)) {
                continue;
            }
            invitation.setStatus(InvitationStatus.EXPIRED);
            invitations.save(invitation);
            senderNotifications.submitExpired(invitation, BusinessNotificationOperationId.generate());
            expiredCount++;
        }
        return new BatchResult(candidateIds.size(), expiredCount);
    }

    public record BatchResult(int candidateCount, int expiredCount) { }
}
