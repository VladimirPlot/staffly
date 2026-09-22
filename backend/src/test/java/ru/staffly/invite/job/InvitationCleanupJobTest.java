package ru.staffly.invite.job;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.invite.service.InvitationExpiryService;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;

import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationCleanupJobTest {
    private static final Instant NOW = Instant.parse("2026-09-21T12:00:00Z");

    @Mock InvitationExpiryService expiryService;
    @InjectMocks InvitationCleanupJob job;

    @AfterEach
    void resetClock() {
        TimeProvider.setClock(Clock.systemUTC());
    }

    @Test
    void materializesExpiredPendingWithoutDeletingInvitationsOrIntents() {
        TimeProvider.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        org.mockito.Mockito.when(expiryService.expireNextBatch(NOW))
                .thenReturn(new InvitationExpiryService.BatchResult(2, 1));

        job.materializeExpiredPending();

        verify(expiryService).expireNextBatch(NOW);
    }

    @Test
    void continuesByCandidateCountRatherThanActualExpiredCount() {
        TimeProvider.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        when(expiryService.expireNextBatch(NOW))
                .thenReturn(new InvitationExpiryService.BatchResult(InvitationExpiryService.BATCH_SIZE, 2))
                .thenReturn(new InvitationExpiryService.BatchResult(3, 3));

        job.materializeExpiredPending();

        verify(expiryService, times(2)).expireNextBatch(NOW);
    }
}
