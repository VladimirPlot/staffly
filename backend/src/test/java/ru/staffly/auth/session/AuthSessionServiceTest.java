package ru.staffly.auth.session;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import ru.staffly.auth.config.AuthProperties;
import ru.staffly.common.time.TimeProvider;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AuthSessionServiceTest {
    private final AuthSessionRepository repository = mock(AuthSessionRepository.class);
    private final AuthSessionService service = new AuthSessionService(repository,
            new AuthProperties(15, 30, "refreshToken", "/api/auth"));

    private AuthSession session() {
        return AuthSession.builder().userId(7L).restaurantId(12L)
                .expiresAt(TimeProvider.nowUtc().plusDays(1)).build();
    }

    @Test void rotationPreservesRestaurantAndRevokesOldToken() {
        var old = session();
        when(repository.findByRefreshHashAndRevokedAtIsNull(anyString())).thenReturn(Optional.of(old));
        var rotated = service.rotateSession("old", "browser", "ip");
        assertEquals(7L, rotated.userId());
        assertEquals(12L, rotated.restaurantId());
        assertNotNull(old.getRevokedAt());
        var saved = ArgumentCaptor.forClass(AuthSession.class);
        verify(repository, times(2)).save(saved.capture());
        var replacement = saved.getAllValues().get(1);
        assertEquals(12L, replacement.getRestaurantId());
        assertEquals(7L, replacement.getUserId());
        assertNotEquals("old", rotated.refreshToken());
        assertNotEquals(rotated.refreshToken(), replacement.getRefreshHash());
    }

    @Test void restaurantCanOnlyBeSelectedInOwnLiveSession() {
        var current = session();
        when(repository.findByRefreshHashAndRevokedAtIsNull(anyString())).thenReturn(Optional.of(current));
        assertThrows(InvalidRefreshSessionException.class, () -> service.selectRestaurant("refresh", 8L, 22L));
        assertEquals(12L, current.getRestaurantId());
        service.selectRestaurant("refresh", 7L, 22L);
        assertEquals(22L, current.getRestaurantId());
    }

    @Test void expiredSessionCannotRotateOrSwitchRestaurant() {
        var expired = session();
        expired.setExpiresAt(TimeProvider.nowUtc().minusMinutes(1));
        when(repository.findByRefreshHashAndRevokedAtIsNull(anyString())).thenReturn(Optional.of(expired));
        assertThrows(InvalidRefreshSessionException.class, () -> service.selectRestaurant("expired", 7L, 22L));
        assertThrows(InvalidRefreshSessionException.class, () -> service.rotateSession("expired", "browser", "ip"));
        assertNotNull(expired.getRevokedAt());
        verify(repository, times(1)).save(any());
    }

    @Test void oldSessionWithoutRestaurantStillRotates() {
        var old = session();
        old.setRestaurantId(null);
        when(repository.findByRefreshHashAndRevokedAtIsNull(anyString())).thenReturn(Optional.of(old));
        assertNull(service.rotateSession("old", "browser", "ip").restaurantId());
    }
}
