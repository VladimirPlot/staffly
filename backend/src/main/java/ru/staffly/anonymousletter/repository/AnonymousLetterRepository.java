package ru.staffly.anonymousletter.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.anonymousletter.model.AnonymousLetter;

import java.time.Instant;
import java.util.List;

public interface AnonymousLetterRepository extends JpaRepository<AnonymousLetter, Long> {

    List<AnonymousLetter> findByRestaurantIdAndSenderIdOrderByCreatedAtDesc(Long restaurantId, Long senderId);

    List<AnonymousLetter> findByRestaurantIdAndRecipientIdOrderByCreatedAtDesc(Long restaurantId, Long recipientId);

    boolean existsByRestaurantIdAndSenderIdAndCreatedAtBetween(Long restaurantId, Long senderId, Instant from, Instant to);

    long countByRestaurantIdAndRecipientIdAndReadAtIsNull(Long restaurantId, Long recipientId);

    java.util.Optional<AnonymousLetter> findByIdAndRestaurantId(Long id, Long restaurantId);
}