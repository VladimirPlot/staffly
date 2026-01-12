package ru.staffly.push.service;

import lombok.RequiredArgsConstructor;
import nl.martijndwars.webpush.Notification;
import nl.martijndwars.webpush.PushService;
import org.apache.http.HttpResponse;
import org.springframework.stereotype.Service;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.model.PushDevice;

import java.nio.charset.StandardCharsets;

@Service
@RequiredArgsConstructor
public class WebPushSender {

    private final PushProperties properties;

    public PushSendResult send(PushDevice device, String payload) {
        try {
            PushProperties.Vapid vapid = properties.vapid();
            if (vapid == null || vapid.publicKey() == null || vapid.privateKey() == null || vapid.subject() == null) {
                return PushSendResult.failure(null, "Missing VAPID configuration");
            }

            PushService pushService = new PushService(vapid.publicKey(), vapid.privateKey(), vapid.subject());
            Notification notification = new Notification(
                    device.getEndpoint(),
                    device.getP256dh(),
                    device.getAuth(),
                    payload == null ? null : payload.getBytes(StandardCharsets.UTF_8)
            );
            HttpResponse response = pushService.send(notification);
            int status = response.getStatusLine().getStatusCode();
            if (status >= 200 && status < 300) {
                return PushSendResult.success(status);
            }
            boolean gone = status == 404 || status == 410;
            return PushSendResult.failure(status, gone ? "Subscription gone" : "Push failed");
        } catch (Exception e) {
            return PushSendResult.failure(null, e.getClass().getSimpleName() + ": " + e.getMessage());
        }
    }

    public record PushSendResult(boolean success, Integer httpStatus, String errorMessage) {
        static PushSendResult success(int status) {
            return new PushSendResult(true, status, null);
        }

        static PushSendResult failure(Integer status, String errorMessage) {
            return new PushSendResult(false, status, errorMessage);
        }

        boolean isGone() {
            return httpStatus != null && (httpStatus == 404 || httpStatus == 410);
        }
    }
}
