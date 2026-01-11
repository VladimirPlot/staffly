package ru.staffly.inbox.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InboxMessageRepository extends JpaRepository<InboxMessage, Long> {

    Optional<InboxMessage> findByIdAndRestaurantId(Long id, Long restaurantId);

    List<InboxMessage> findByRestaurantIdAndTypeOrderByCreatedAtDesc(Long restaurantId, InboxMessageType type);

    boolean existsByRestaurantIdAndTypeAndMeta(Long restaurantId, InboxMessageType type, String meta);

    Optional<InboxMessage> findByRestaurantIdAndTypeAndMeta(Long restaurantId, InboxMessageType type, String meta);

    @Query("""
        select m.id from InboxMessage m
        where m.type = :type
          and ((m.expiresAt is not null and m.expiresAt < :expiresBefore)
            or (m.expiresAt is null and m.createdAt < :createdBefore))
        """)
    List<Long> findAnnouncementIdsForCleanup(@Param("type") InboxMessageType type,
                                             @Param("expiresBefore") LocalDate expiresBefore,
                                             @Param("createdBefore") Instant createdBefore);

    @Query("""
        select m.id from InboxMessage m
        where m.type = :type
          and m.createdAt < :createdBefore
        """)
    List<Long> findEventIdsForCleanup(@Param("type") InboxMessageType type,
                                      @Param("createdBefore") Instant createdBefore);

    @Query("""
        select m.id from InboxMessage m
        where m.type = :type
          and m.expiresAt is not null
          and m.expiresAt < :expiresBefore
        """)
    List<Long> findBirthdayIdsForCleanup(@Param("type") InboxMessageType type,
                                         @Param("expiresBefore") LocalDate expiresBefore);
}