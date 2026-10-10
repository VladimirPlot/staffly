package ru.staffly.auth.controller;

import jakarta.servlet.http.Cookie;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockHttpServletRequest;
import org.springframework.security.crypto.password.PasswordEncoder;
import ru.staffly.auth.config.AuthProperties;
import ru.staffly.auth.dto.SwitchRestaurantRequest;
import ru.staffly.auth.dto.RefreshRequest;
import ru.staffly.auth.session.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.*;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import java.util.List;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class AuthControllerSessionTest {
    private final UserRepository users = mock(UserRepository.class);
    private final JwtService jwt = mock(JwtService.class);
    private final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    private final SecurityService security = mock(SecurityService.class);
    private final AuthSessionService sessions = mock(AuthSessionService.class);
    private final GlobalCreatorPolicy creators = mock(GlobalCreatorPolicy.class);
    private final RestaurantRepository restaurants = mock(RestaurantRepository.class);
    private final AuthProperties props = new AuthProperties(15, 30, "refreshToken", "/api/auth");
    private final AuthController controller = new AuthController(users, mock(PasswordEncoder.class), jwt,
            members, security, sessions, new RefreshCookieService(props), props, creators, restaurants);
    private final User user = User.builder().id(7L).phone("phone").active(true).build();

    private MockHttpServletRequest request() {
        var request = new MockHttpServletRequest();
        request.setCookies(new Cookie("refreshToken", "old"));
        when(sessions.rotateSession(eq("old"), any(), any())).thenReturn(new AuthSessionService.RotationResult(7L, 12L, "new"));
        when(users.findById(7L)).thenReturn(Optional.of(user));
        when(jwt.generateToken(any())).thenReturn("access");
        when(restaurants.existsById(12L)).thenReturn(true);
        return request;
    }

    @Test void refreshRestoresRestaurantForActiveMember() {
        var request = request();
        when(security.isRestaurantUnlocked(12L)).thenReturn(true);
        when(members.findActiveByUserIdAndRestaurantId(7L, 12L)).thenReturn(Optional.of(new RestaurantMember()));
        assertEquals(200, controller.refresh(request, null).getStatusCode().value());
        verify(jwt).generateToken(new UserPrincipal(7L, "phone", 12L, List.of()));
    }

    @Test void refreshClearsRestaurantAfterMembershipRevocation() {
        var request = request();
        when(security.isRestaurantUnlocked(12L)).thenReturn(true);
        when(members.findActiveByUserIdAndRestaurantId(7L, 12L)).thenReturn(Optional.empty());
        assertEquals(200, controller.refresh(request, null).getStatusCode().value());
        verify(jwt).generateToken(new UserPrincipal(7L, "phone", null, List.of()));
        verify(sessions).selectRestaurant("new", 7L, null);
    }

    @Test void lockedRestaurantIsNotRestored() {
        assertEquals(200, controller.refresh(request(), null).getStatusCode().value());
        verify(jwt).generateToken(new UserPrincipal(7L, "phone", null, List.of()));
    }

    @Test void creatorCanRestoreLockedRestaurantWithoutMembership() {
        var request = request();
        when(creators.isCreator(user)).thenReturn(true);
        controller.refresh(request, null);
        verify(jwt).generateToken(new UserPrincipal(7L, "phone", 12L, List.of("CREATOR")));
    }

    @Test void disabledUserCannotRefresh() {
        var request = request();
        user.setActive(false);
        assertEquals(401, controller.refresh(request, null).getStatusCode().value());
        verify(sessions).revokeSession("new");
        verify(jwt, never()).generateToken(any());
    }

    @Test void infrastructureFailureIsNotDisguisedAsExpiredSession() {
        var request = request();
        when(sessions.rotateSession(eq("old"), any(), any())).thenThrow(new IllegalStateException("database down"));
        assertThrows(IllegalStateException.class, () -> controller.refresh(request, null));
    }

    @Test void switchingRestaurantPersistsSelectionAfterAuthorization() {
        var request = request();
        when(members.findActiveByUserIdAndRestaurantId(7L, 12L)).thenReturn(Optional.of(new RestaurantMember()));
        controller.switchRestaurant(new UserPrincipal(7L, "phone", null, List.of()), new SwitchRestaurantRequest(12L), request);
        verify(sessions).selectRestaurant("old", 7L, 12L);
    }

    @Test void preMigrationSessionUsesValidatedRestaurantHint() {
        var request = request();
        when(sessions.rotateSession(eq("old"), any(), any())).thenReturn(new AuthSessionService.RotationResult(7L, null, "new"));
        when(security.isRestaurantUnlocked(12L)).thenReturn(true);
        when(members.findActiveByUserIdAndRestaurantId(7L, 12L)).thenReturn(Optional.of(new RestaurantMember()));
        controller.refresh(request, new RefreshRequest(12L));
        verify(jwt).generateToken(new UserPrincipal(7L, "phone", 12L, List.of()));
        verify(sessions).selectRestaurant("new", 7L, 12L);
    }

    @Test void restaurantHintCannotGrantAccessToAnotherRestaurant() {
        var request = request();
        when(sessions.rotateSession(eq("old"), any(), any())).thenReturn(new AuthSessionService.RotationResult(7L, null, "new"));
        controller.refresh(request, new RefreshRequest(99L));
        verify(jwt).generateToken(new UserPrincipal(7L, "phone", null, List.of()));
        verify(sessions, never()).selectRestaurant(any(), any(), any());
    }
}
