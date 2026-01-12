package ru.staffly.push.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.boot.autoconfigure.condition.ConditionalOnProperty;
import org.springframework.scheduling.annotation.Scheduled;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.model.PushDelivery;
import ru.staffly.push.model.PushDeliveryStatus;
import ru.staffly.push.model.PushDevice;
import ru.staffly.push.repository.PushDeliveryRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.UUID;

@Slf4j
@Service
@RequiredArgsConstructor
@ConditionalOnProperty(
        prefix = "app.push",
        name = {"enabled", "worker.enabled"},
        havingValue = "true",
        matchIfMissing = true
)
public class PushDeliveryWorker {

    private static final int BATCH_SIZE = 50;
    private static final int MAX_ATTEMPTS = 10;
    private static final Duration LOCK_DURATION = Duration.ofMinutes(1);

    private final PushDeliveryRepository deliveryRepository;
    private final PushDeviceService deviceService;
    private final WebPushSender sender;
    private final PushProperties properties;

    private final String lockOwner = "worker-" + UUID.randomUUID();

    @Scheduled(fixedDelayString = "PT5S")
    @Transactional
    public void run() {
        if (!properties.enabled()) {
            return;
        }
        List<PushDelivery> deliveries = lockBatch();
        for (PushDelivery delivery : deliveries) {
            handleDelivery(delivery);
        }
    }

    @Transactional
    public List<PushDelivery> lockBatch() {
        Instant now = TimeProvider.now();
        List<Long> ids = deliveryRepository.lockBatchForSending(now, BATCH_SIZE);
        if (ids.isEmpty()) {
            return List.of();
        }
        deliveryRepository.markAsSending(ids, lockOwner, now.plus(LOCK_DURATION), now);
        return deliveryRepository.findAllById(ids);
    }

    public void handleDelivery(PushDelivery delivery) {
        Long userId = delivery.getUserId();
        List<PushDevice> devices = deviceService.findActiveDevices(userId);
        if (devices.isEmpty()) {
            markDead(delivery, "No active devices", null);
            return;
        }

        int successCount = 0;
        String lastError = null;
        Integer lastStatus = null;

        for (PushDevice device : devices) {
            WebPushSender.PushSendResult result = sender.send(device, delivery.getPayload());
            if (result.success()) {
                successCount++;
                lastStatus = result.httpStatus();
            } else if (result.isGone()) {
                lastStatus = result.httpStatus();
                lastError = result.errorMessage();
                deviceService.disableById(device.getId());
            } else {
                lastStatus = result.httpStatus();
                lastError = result.errorMessage();
            }
        }

        if (successCount > 0) {
            markSent(delivery, null, lastStatus);
            return;
        }

        int attempts = delivery.getAttempts();
        if (attempts >= MAX_ATTEMPTS) {
            markFailed(delivery, lastError, lastStatus, PushDeliveryStatus.FAILED);
            return;
        }

        markRetry(delivery, lastError, lastStatus, attempts);
    }

    private void markDead(PushDelivery delivery, String error, Integer status) {
        Instant now = TimeProvider.now();
        deliveryRepository.markFailed(
                delivery.getId(),
                PushDeliveryStatus.DEAD.name(),
                error,
                status,
                now
        );
        log.info("Push delivery dead id={} userId={} restaurantId={} refId={} attempts={} status={} error={}",
                delivery.getId(),
                delivery.getUserId(),
                delivery.getRestaurantId(),
                delivery.getRefId(),
                delivery.getAttempts(),
                PushDeliveryStatus.DEAD,
                error);
    }

    private void markSent(PushDelivery delivery, String error, Integer status) {
        Instant now = TimeProvider.now();
        deliveryRepository.markSent(
                delivery.getId(),
                PushDeliveryStatus.SENT.name(),
                now,
                error,
                status,
                now
        );
        log.info("Push delivery sent id={} userId={} restaurantId={} refId={} attempts={} status={} httpStatus={}",
                delivery.getId(),
                delivery.getUserId(),
                delivery.getRestaurantId(),
                delivery.getRefId(),
                delivery.getAttempts(),
                PushDeliveryStatus.SENT,
                status);
    }

    private void markRetry(PushDelivery delivery, String error, Integer status, int attempts) {
        Instant now = TimeProvider.now();
        Instant next = now.plus(resolveBackoff(attempts));
        deliveryRepository.updateRetry(
                delivery.getId(),
                PushDeliveryStatus.RETRY.name(),
                next,
                error,
                status,
                now
        );
        log.info("Push delivery retry id={} userId={} restaurantId={} refId={} attempts={} status={} nextAttemptAt={} httpStatus={} error={}",
                delivery.getId(),
                delivery.getUserId(),
                delivery.getRestaurantId(),
                delivery.getRefId(),
                delivery.getAttempts(),
                PushDeliveryStatus.RETRY,
                next,
                status,
                error);
    }

    private void markFailed(PushDelivery delivery, String error, Integer status, PushDeliveryStatus finalStatus) {
        Instant now = TimeProvider.now();
        deliveryRepository.markFailed(
                delivery.getId(),
                finalStatus.name(),
                error,
                status,
                now
        );
        log.info("Push delivery failed id={} userId={} restaurantId={} refId={} attempts={} status={} httpStatus={} error={}",
                delivery.getId(),
                delivery.getUserId(),
                delivery.getRestaurantId(),
                delivery.getRefId(),
                delivery.getAttempts(),
                finalStatus,
                status,
                error);
    }

    private Duration resolveBackoff(int attempts) {
        return switch (attempts) {
            case 1 -> Duration.ofSeconds(30);
            case 2 -> Duration.ofMinutes(2);
            case 3 -> Duration.ofMinutes(10);
            case 4 -> Duration.ofHours(1);
            default -> Duration.ofHours(6);
        };
    }
}
