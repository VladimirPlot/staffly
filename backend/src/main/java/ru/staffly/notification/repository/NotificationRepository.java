package ru.staffly.notification.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.notification.model.Notification;

import java.util.List;
import java.util.Optional;

public interface NotificationRepository extends JpaRepository<Notification, Long> {

    @EntityGraph(attributePaths = {"positions", "creator", "restaurant"})
    List<Notification> findAllByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"positions", "creator", "restaurant"})
    Optional<Notification> findByIdAndRestaurantId(Long id, Long restaurantId);
}