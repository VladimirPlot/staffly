package ru.staffly.invite.job;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class InvitationCleanupJobTest {
    private static final Instant NOW = Instant.parse("2026-09-21T12:00:00Z");

    @Mock InvitationRepository invitations;
    @InjectMocks InvitationCleanupJob job;

    @AfterEach
    void resetClock() {
        TimeProvider.setClock(Clock.systemUTC());
    }

    @Test
    void materializesExpiredPendingWithoutDeletingInvitationsOrIntents() {
        TimeProvider.setClock(Clock.fixed(NOW, ZoneOffset.UTC));

        job.materializeExpiredPending();

        verify(invitations).expirePendingAtOrBefore(InvitationStatus.PENDING, InvitationStatus.EXPIRED, NOW);
    }
}
