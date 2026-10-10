package ru.staffly.auth.session;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.auth.config.AuthProperties;
import ru.staffly.common.time.TimeProvider;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.SecureRandom;
import java.time.LocalDateTime;
import java.util.Base64;
import java.util.HexFormat;

@Service
@RequiredArgsConstructor
public class AuthSessionService {
    private final AuthSessionRepository repository;
    private final AuthProperties authProperties;
    private final SecureRandom secureRandom = new SecureRandom();

    public record RotationResult(Long userId, Long restaurantId, String refreshToken) {}

    @Transactional
    public String createSession(Long userId, String userAgent, String ip) {
        return createSession(userId, null, userAgent, ip);
    }

    private String createSession(Long userId, Long restaurantId, String userAgent, String ip) {
        String refreshToken = generateRefreshToken();
        String refreshHash = hash(refreshToken);
        LocalDateTime now = TimeProvider.nowUtc();
        LocalDateTime expiresAt = now.plusDays(authProperties.refreshTtlDays());
        AuthSession session = AuthSession.builder()
                .userId(userId)
                .restaurantId(restaurantId)
                .refreshHash(refreshHash)
                .createdAt(now)
                .expiresAt(expiresAt)
                .userAgent(userAgent)
                .ip(ip)
                .build();
        repository.save(session);
        return refreshToken;
    }

    @Transactional(noRollbackFor = InvalidRefreshSessionException.class)
    public RotationResult rotateSession(String refreshToken, String userAgent, String ip) {
        String refreshHash = hash(refreshToken);
        AuthSession session = repository.findByRefreshHashAndRevokedAtIsNull(refreshHash)
                .orElseThrow(() -> new InvalidRefreshSessionException("Invalid refresh token"));
        LocalDateTime now = TimeProvider.nowUtc();
        if (!session.getExpiresAt().isAfter(now)) {
            session.setRevokedAt(now);
            repository.save(session);
            throw new InvalidRefreshSessionException("Refresh token expired");
        }
        session.setRevokedAt(now);
        repository.save(session);
        String newRefresh = createSession(session.getUserId(), session.getRestaurantId(), userAgent, ip);
        return new RotationResult(session.getUserId(), session.getRestaurantId(), newRefresh);
    }

    @Transactional
    public void selectRestaurant(String refreshToken, Long userId, Long restaurantId) {
        if (refreshToken == null || refreshToken.isBlank()) return;
        var session = repository.findByRefreshHashAndRevokedAtIsNull(hash(refreshToken))
                .orElseThrow(() -> new InvalidRefreshSessionException("Invalid refresh token"));
        if (!session.getUserId().equals(userId) || !session.getExpiresAt().isAfter(TimeProvider.nowUtc())) {
            throw new InvalidRefreshSessionException("Invalid refresh session");
        }
        session.setRestaurantId(restaurantId);
        repository.save(session);
    }

    @Transactional
    public void revokeSession(String refreshToken) {
        String refreshHash = hash(refreshToken);
        repository.findByRefreshHashAndRevokedAtIsNull(refreshHash)
                .ifPresent(session -> {
                    session.setRevokedAt(TimeProvider.nowUtc());
                    repository.save(session);
                });
    }

    private String generateRefreshToken() {
        byte[] bytes = new byte[48];
        secureRandom.nextBytes(bytes);
        return Base64.getUrlEncoder().withoutPadding().encodeToString(bytes);
    }

    private String hash(String token) {
        try {
            MessageDigest digest = MessageDigest.getInstance("SHA-256");
            byte[] hashed = digest.digest(token.getBytes(StandardCharsets.UTF_8));
            return HexFormat.of().formatHex(hashed);
        } catch (Exception e) {
            throw new IllegalStateException("Cannot hash refresh token", e);
        }
    }
}
