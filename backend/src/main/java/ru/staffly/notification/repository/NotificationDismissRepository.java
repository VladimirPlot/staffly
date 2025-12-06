package ru.staffly.notification.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.notification.model.NotificationDismiss;

import java.util.List;

public interface NotificationDismissRepository extends JpaRepository<NotificationDismiss, Long> {

    List<NotificationDismiss> findByMemberId(Long memberId);

    boolean existsByNotificationIdAndMemberId(Long notificationId, Long memberId);
}