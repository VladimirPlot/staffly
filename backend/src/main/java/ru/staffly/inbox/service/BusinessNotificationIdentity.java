package ru.staffly.inbox.service;

import ru.staffly.inbox.model.BusinessNotificationKind;

import java.util.Objects;
import java.util.UUID;

final class BusinessNotificationIdentity {
    private BusinessNotificationIdentity() {
    }

    static String meta(Long restaurantId, UUID operationId, Long recipientMemberId,
                       BusinessNotificationKind kind) {
        Objects.requireNonNull(restaurantId, "restaurantId is required");
        Objects.requireNonNull(operationId, "operationId is required");
        Objects.requireNonNull(recipientMemberId, "recipientMemberId is required");
        Objects.requireNonNull(kind, "kind is required");
        return "business:v1:restaurant:" + restaurantId
                + ":operation:" + operationId
                + ":recipient:" + recipientMemberId
                + ":kind:" + kind.name();
    }
}
