package ru.staffly.invite.controller;

import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.invite.exception.InvitationExpiredException;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.Optional;
import java.util.List;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.verify;

@ExtendWith(MockitoExtension.class)
class InvitationAcceptanceControllerTest {
    private static final Instant NOW = Instant.parse("2026-09-21T12:00:00Z");

    @Mock EmployeeService employees;
    @Mock InvitationRepository invitations;
    @Mock UserRepository users;
    @InjectMocks InvitationAcceptanceController controller;

    @AfterEach
    void resetClock() {
        TimeProvider.setClock(Clock.systemUTC());
    }

    @Test
    void declineExpiredPendingMaterializesExpiredInsteadOfDeclined() {
        TimeProvider.setClock(Clock.fixed(NOW, ZoneOffset.UTC));
        Invitation invitation = Invitation.builder().token("token").phoneOrEmail("user@example.com")
                .status(InvitationStatus.PENDING).expiresAt(NOW).build();
        User user = User.builder().id(9L).email("user@example.com").build();
        org.mockito.Mockito.when(invitations.findForUpdateByToken("token")).thenReturn(Optional.of(invitation));
        org.mockito.Mockito.when(users.findById(9L)).thenReturn(Optional.of(user));

        assertThrows(InvitationExpiredException.class,
                () -> controller.decline("token", new UserPrincipal(9L, null, null, List.of())));

        assertEquals(InvitationStatus.EXPIRED, invitation.getStatus());
        verify(invitations).saveAndFlush(invitation);
    }
}
