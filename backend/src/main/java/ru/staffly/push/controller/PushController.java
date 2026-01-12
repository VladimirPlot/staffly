package ru.staffly.push.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.service.PushDeviceService;
import ru.staffly.security.UserPrincipal;

import java.util.Map;

@RestController
@RequestMapping("/api/push")
@RequiredArgsConstructor
public class PushController {

    private final PushDeviceService deviceService;
    private final PushProperties properties;

    @GetMapping("/vapid-public-key")
    public ResponseEntity<Map<String, String>> getPublicKey() {
        if (!properties.enabled() || properties.vapid() == null || properties.vapid().publicKey() == null
                || properties.vapid().publicKey().isBlank()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        return ResponseEntity.ok(Map.of("publicKey", properties.vapid().publicKey()));
    }

    @PostMapping("/subscribe")
    public ResponseEntity<Void> subscribe(@AuthenticationPrincipal UserPrincipal principal,
                                          @RequestBody PushSubscriptionRequest request) {
        if (!properties.enabled()) {
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).build();
        }
        if (request == null || request.endpoint() == null || request.keys() == null) {
            return ResponseEntity.badRequest().build();
        }
        deviceService.upsertDevice(
                principal.userId(),
                request.endpoint(),
                request.keys().p256dh(),
                request.keys().auth(),
                request.expirationTime(),
                request.userAgent(),
                request.platform()
        );
        return ResponseEntity.ok().build();
    }

    @PostMapping("/unsubscribe")
    public ResponseEntity<Void> unsubscribe(@AuthenticationPrincipal UserPrincipal principal,
                                            @RequestBody PushUnsubscribeRequest request) {
        if (request == null || request.endpoint() == null || request.endpoint().isBlank()) {
            return ResponseEntity.badRequest().build();
        }
        deviceService.disableByEndpoint(principal.userId(), request.endpoint());
        return ResponseEntity.ok().build();
    }

    public record PushSubscriptionRequest(
            String endpoint,
            Keys keys,
            Long expirationTime,
            String userAgent,
            String platform
    ) {
        public record Keys(String p256dh, String auth) {}
    }

    public record PushUnsubscribeRequest(String endpoint) {}
}
