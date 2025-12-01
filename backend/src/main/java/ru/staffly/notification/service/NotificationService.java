package ru.staffly.notification.service;

import ru.staffly.notification.dto.NotificationDto;
import ru.staffly.notification.dto.NotificationRequest;

import java.util.List;

public interface NotificationService {
    List<NotificationDto> list(Long restaurantId, Long currentUserId);
    NotificationDto create(Long restaurantId, Long currentUserId, NotificationRequest request);
    NotificationDto update(Long restaurantId, Long currentUserId, Long notificationId, NotificationRequest request);
    void delete(Long restaurantId, Long currentUserId, Long notificationId);
}