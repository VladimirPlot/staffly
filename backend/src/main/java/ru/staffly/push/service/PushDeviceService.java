package ru.staffly.push.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.push.model.PushDevice;
import ru.staffly.push.repository.PushDeviceRepository;

import java.time.Instant;
import java.util.List;

@Service
@RequiredArgsConstructor
public class PushDeviceService {

    private final PushDeviceRepository repository;

    public List<PushDevice> findActiveDevices(Long userId) {
        return repository.findActiveDevicesByUserId(userId);
    }

    @Transactional
    public void upsertDevice(Long userId,
                             String endpoint,
                             String p256dh,
                             String auth,
                             Long expirationTime,
                             String userAgent,
                             String platform) {
        Instant now = TimeProvider.now();
        repository.upsertDevice(userId, endpoint, p256dh, auth, expirationTime, userAgent, platform, now);
    }

    @Transactional
    public void disableByEndpoint(String endpoint) {
        repository.disableByEndpoint(endpoint, TimeProvider.now());
    }

    @Transactional
    public void disableById(Long deviceId) {
        repository.disableById(deviceId, TimeProvider.now());
    }
}
