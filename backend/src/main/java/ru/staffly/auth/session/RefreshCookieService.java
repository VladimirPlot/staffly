package ru.staffly.auth.session;

import jakarta.servlet.http.HttpServletRequest;
import lombok.RequiredArgsConstructor;
import org.springframework.http.ResponseCookie;
import org.springframework.stereotype.Component;
import ru.staffly.auth.config.AuthProperties;

import java.time.Duration;

@Component
@RequiredArgsConstructor
public class RefreshCookieService {
    private final AuthProperties authProperties;

    public ResponseCookie buildRefreshCookie(String refreshToken, HttpServletRequest request) {
        return ResponseCookie.from(authProperties.refreshCookieName(), refreshToken)
                .httpOnly(true)
                .path(authProperties.refreshCookiePath())
                .sameSite("Lax")
                .maxAge(Duration.ofDays(authProperties.refreshTtlDays()))
                .secure(isHttps(request))
                .build();
    }

    public ResponseCookie clearRefreshCookie(HttpServletRequest request) {
        return ResponseCookie.from(authProperties.refreshCookieName(), "")
                .httpOnly(true)
                .path(authProperties.refreshCookiePath())
                .sameSite("Lax")
                .maxAge(0)
                .secure(isHttps(request))
                .build();
    }

    private boolean isHttps(HttpServletRequest request) {
        if (request.isSecure()) {
            return true;
        }
        String header = request.getHeader("X-Forwarded-Proto");
        if (header == null || header.isBlank()) {
            return false;
        }
        String first = header.split(",")[0].trim();
        return "https".equalsIgnoreCase(first);
    }
}