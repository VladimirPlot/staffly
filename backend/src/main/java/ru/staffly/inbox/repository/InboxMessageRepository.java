package ru.staffly.inbox.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;

import java.util.List;
import java.util.Optional;

public interface InboxMessageRepository extends JpaRepository<InboxMessage, Long> {

    Optional<InboxMessage> findByIdAndRestaurantId(Long id, Long restaurantId);

    List<InboxMessage> findByRestaurantIdAndTypeOrderByCreatedAtDesc(Long restaurantId, InboxMessageType type);

    boolean existsByRestaurantIdAndTypeAndMeta(Long restaurantId, InboxMessageType type, String meta);

    Optional<InboxMessage> findByRestaurantIdAndTypeAndMeta(Long restaurantId, InboxMessageType type, String meta);
}