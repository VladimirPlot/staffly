package ru.staffly.auth.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.auth")
public record AuthProperties(
        long accessTtlMinutes,
        long refreshTtlDays,
        String refreshCookieName,
        String refreshCookiePath
) {}