package ru.staffly.push.config;

import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "app.push")
public record PushProperties(
        boolean enabled,
        Worker worker,
        Vapid vapid
) {
    public record Worker(boolean enabled) {}

    public record Vapid(
            String publicKey,
            String privateKey,
            String subject
    ) {}
}
