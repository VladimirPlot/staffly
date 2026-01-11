package ru.staffly.inbox.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InboxRecipientRepository extends JpaRepository<InboxRecipient, Long> {

    Optional<InboxRecipient> findByMessageIdAndMemberId(Long messageId, Long memberId);

    @EntityGraph(attributePaths = {"message", "message.createdBy", "message.positions"})
    @Query("""
        select r from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type = :type
          and r.archivedAt is null
          and r.readAt is null
          and (m.expiresAt is null or m.expiresAt >= :today)
        order by m.createdAt desc
        """)
    Page<InboxRecipient> findUnread(@Param("memberId") Long memberId,
                                    @Param("restaurantId") Long restaurantId,
                                    @Param("type") InboxMessageType type,
                                    @Param("today") LocalDate today,
                                    Pageable pageable);

    @EntityGraph(attributePaths = {"message", "message.createdBy", "message.positions"})
    @Query("""
        select r from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type = :type
          and r.archivedAt is null
          and (m.expiresAt is null or m.expiresAt >= :today)
        order by m.createdAt desc
        """)
    Page<InboxRecipient> findActive(@Param("memberId") Long memberId,
                                    @Param("restaurantId") Long restaurantId,
                                    @Param("type") InboxMessageType type,
                                    @Param("today") LocalDate today,
                                    Pageable pageable);

    @EntityGraph(attributePaths = {"message", "message.createdBy", "message.positions"})
    @Query("""
        select r from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type = :type
          and (r.archivedAt is not null
            or (m.type = 'ANNOUNCEMENT' and m.expiresAt is not null and m.expiresAt < :today))
        order by m.createdAt desc
        """)
    Page<InboxRecipient> findArchivedOrExpired(@Param("memberId") Long memberId,
                                               @Param("restaurantId") Long restaurantId,
                                               @Param("type") InboxMessageType type,
                                               @Param("today") LocalDate today,
                                               Pageable pageable);

    @Query("""
        select count(r) from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and r.archivedAt is null
          and r.readAt is null
          and (m.expiresAt is null or m.expiresAt >= :today)
        """)
    long countUnread(@Param("memberId") Long memberId,
                     @Param("restaurantId") Long restaurantId,
                     @Param("today") LocalDate today);

    @Query("""
        select count(r) from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type = :type
          and r.archivedAt is null
          and r.readAt is null
          and (m.expiresAt is null or m.expiresAt >= :today)
        """)
    long countUnreadByType(@Param("memberId") Long memberId,
                           @Param("restaurantId") Long restaurantId,
                           @Param("type") InboxMessageType type,
                           @Param("today") LocalDate today);

    @Query("""
        select count(r) from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type = 'EVENT'
          and m.eventSubtype in :subtypes
          and r.archivedAt is null
          and r.readAt is null
          and (m.expiresAt is null or m.expiresAt >= :today)
        """)
    long countUnreadEventsBySubtypes(@Param("memberId") Long memberId,
                                     @Param("restaurantId") Long restaurantId,
                                     @Param("subtypes") List<InboxEventSubtype> subtypes,
                                     @Param("today") LocalDate today);
}