package ru.staffly.push.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.push.config.PushProperties;
import ru.staffly.push.repository.PushDeliveryRepository;

import java.time.Instant;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PushEnqueueService {

    private static final String REF_TYPE_INBOX = "INBOX_MESSAGE";

    private final PushDeliveryRepository deliveryRepository;
    private final PushPayloadFactory payloadFactory;
    private final PushProperties properties;

    @Transactional
    public void enqueueForMessage(InboxMessage message, List<RestaurantMember> recipients) {
        if (!properties.enabled() || recipients == null || recipients.isEmpty()) {
            return;
        }
        Set<Long> userIds = recipients.stream()
                .map(member -> member.getUser().getId())
                .filter(id -> id != null)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) {
            return;
        }
        String payload = payloadFactory.buildForMessage(message);
        Instant now = TimeProvider.now();
        Long restaurantId = message.getRestaurant().getId();
        Long refId = message.getId();

        for (Long userId : userIds) {
            deliveryRepository.enqueueDelivery(
                    REF_TYPE_INBOX,
                    refId,
                    restaurantId,
                    userId,
                    payload,
                    "PENDING",
                    now,
                    now
            );
        }
    }
}
