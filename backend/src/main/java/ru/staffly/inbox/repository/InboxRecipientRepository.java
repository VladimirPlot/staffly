package ru.staffly.inbox.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;
import ru.staffly.inbox.model.InboxState;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface InboxRecipientRepository extends JpaRepository<InboxRecipient, Long> {

    Optional<InboxRecipient> findByMessageIdAndMemberId(Long messageId, Long memberId);

    @Query("""
        select r.member.id from InboxRecipient r
        where r.message.id = :messageId
        """)
    List<Long> findMemberIdsByMessageId(@Param("messageId") Long messageId);

    @EntityGraph(attributePaths = {"message", "message.createdBy", "message.positions"})
    @Query("""
        select r from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type in :types
          and r.archivedAt is null
          and r.readAt is null
          and (m.expiresAt is null or m.expiresAt >= :today)
        order by m.createdAt desc
        """)
    Page<InboxRecipient> findUnreadByTypes(@Param("memberId") Long memberId,
                                           @Param("restaurantId") Long restaurantId,
                                           @Param("types") List<InboxMessageType> types,
                                           @Param("today") LocalDate today,
                                           Pageable pageable);

    @EntityGraph(attributePaths = {"message", "message.createdBy", "message.positions"})
    @Query("""
        select r from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type in :types
          and r.archivedAt is null
          and r.readAt is not null
          and (m.expiresAt is null or m.expiresAt >= :today)
        order by m.createdAt desc
        """)
    Page<InboxRecipient> findReadByTypes(@Param("memberId") Long memberId,
                                         @Param("restaurantId") Long restaurantId,
                                         @Param("types") List<InboxMessageType> types,
                                         @Param("today") LocalDate today,
                                         Pageable pageable);

    @EntityGraph(attributePaths = {"message", "message.createdBy", "message.positions"})
    @Query("""
        select r from InboxRecipient r
        join r.message m
        where r.member.id = :memberId
          and m.restaurant.id = :restaurantId
          and m.type in :types
          and (r.archivedAt is not null
            or (m.expiresAt is not null and m.expiresAt < :today))
        order by m.createdAt desc
        """)
    Page<InboxRecipient> findHiddenByTypes(@Param("memberId") Long memberId,
                                           @Param("restaurantId") Long restaurantId,
                                           @Param("types") List<InboxMessageType> types,
                                           @Param("today") LocalDate today,
                                           Pageable pageable);

    default Page<InboxRecipient> findByState(Long memberId,
                                             Long restaurantId,
                                             List<InboxMessageType> types,
                                             InboxState state,
                                             LocalDate today,
                                             Pageable pageable) {
        return switch (state) {
            case UNREAD -> findUnreadByTypes(memberId, restaurantId, types, today, pageable);
            case READ -> findReadByTypes(memberId, restaurantId, types, today, pageable);
            case HIDDEN -> findHiddenByTypes(memberId, restaurantId, types, today, pageable);
        };
    }

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

    void deleteByMessageIdIn(List<Long> messageIds);

    @Modifying
    @Query(value = """
        with ranked as (
            select r.id,
                   row_number() over (partition by r.member_id order by m.created_at desc) as rn
            from inbox_recipients r
            join inbox_messages m on m.id = r.message_id
        )
        delete from inbox_recipients
        where id in (select id from ranked where rn > :limit)
        """, nativeQuery = true)
    int deleteOverflowRecipients(@Param("limit") int limit);
}