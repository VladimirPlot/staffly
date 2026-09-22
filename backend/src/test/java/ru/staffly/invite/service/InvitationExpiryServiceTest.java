package ru.staffly.invite.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.data.domain.Pageable;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationExpiryServiceTest {
    private static final Instant NOW = Instant.parse("2026-09-21T12:00:00Z");

    @Mock InvitationRepository invitations;
    @Mock InvitationSenderNotificationService senderNotifications;

    @Test
    void locksAndNotifiesOnlyCandidatesThatStillTransitionToExpired() {
        Invitation pending = Invitation.builder().id(1L).status(InvitationStatus.PENDING).expiresAt(NOW).build();
        Invitation concurrentlyAccepted = Invitation.builder().id(2L).status(InvitationStatus.ACCEPTED)
                .expiresAt(NOW.minusSeconds(1)).build();
        when(invitations.findExpiredPendingIds(eq(InvitationStatus.PENDING), eq(NOW), any(Pageable.class)))
                .thenReturn(List.of(1L, 2L));
        when(invitations.findForUpdateById(1L)).thenReturn(Optional.of(pending));
        when(invitations.findForUpdateById(2L)).thenReturn(Optional.of(concurrentlyAccepted));
        InvitationExpiryService service = new InvitationExpiryService(invitations, senderNotifications);

        assertThat(service.expireNextBatch(NOW))
                .isEqualTo(new InvitationExpiryService.BatchResult(2, 1));

        assertThat(pending.getStatus()).isEqualTo(InvitationStatus.EXPIRED);
        verify(invitations).save(pending);
        verify(senderNotifications).submitExpired(eq(pending), any());
        verify(senderNotifications, never()).submitExpired(eq(concurrentlyAccepted), any());
    }
}
