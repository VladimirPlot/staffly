package ru.staffly.auth.session;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.auth.config.AuthProperties;

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

    public record RotationResult(Long userId, String refreshToken) {}

    @Transactional
    public String createSession(Long userId, String userAgent, String ip) {
        String refreshToken = generateRefreshToken();
        String refreshHash = hash(refreshToken);
        LocalDateTime now = LocalDateTime.now();
        LocalDateTime expiresAt = now.plusDays(authProperties.refreshTtlDays());
        AuthSession session = AuthSession.builder()
                .userId(userId)
                .refreshHash(refreshHash)
                .createdAt(now)
                .expiresAt(expiresAt)
                .userAgent(userAgent)
                .ip(ip)
                .build();
        repository.save(session);
        return refreshToken;
    }

    @Transactional
    public RotationResult rotateSession(String refreshToken, String userAgent, String ip) {
        String refreshHash = hash(refreshToken);
        AuthSession session = repository.findByRefreshHashAndRevokedAtIsNull(refreshHash)
                .orElseThrow(() -> new IllegalArgumentException("Invalid refresh token"));
        LocalDateTime now = LocalDateTime.now();
        if (!session.getExpiresAt().isAfter(now)) {
            session.setRevokedAt(now);
            repository.save(session);
            throw new IllegalArgumentException("Refresh token expired");
        }
        session.setRevokedAt(now);
        repository.save(session);
        String newRefresh = createSession(session.getUserId(), userAgent, ip);
        return new RotationResult(session.getUserId(), newRefresh);
    }

    @Transactional
    public void revokeSession(String refreshToken) {
        String refreshHash = hash(refreshToken);
        repository.findByRefreshHashAndRevokedAtIsNull(refreshHash)
                .ifPresent(session -> {
                    session.setRevokedAt(LocalDateTime.now());
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