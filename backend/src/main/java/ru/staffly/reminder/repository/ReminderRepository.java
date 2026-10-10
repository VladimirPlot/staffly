package ru.staffly.reminder.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.reminder.model.Reminder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReminderRepository extends JpaRepository<Reminder, Long> {

    @Query("""
            select distinct r from Reminder r left join r.targetMembers tm left join r.targetMember legacy
            where r.targetType = ru.staffly.reminder.model.ReminderTargetType.MEMBER
              and (legacy.id = :memberId or tm.id = :memberId)
            """)
    List<Reminder> findTargetingMember(@Param("memberId") Long memberId);

    default int countByTargetMemberId(Long memberId) {
        return findTargetingMember(memberId).size();
    }

    default int detachPersonalTarget(Long memberId, Instant now) {
        List<Reminder> affected = findTargetingMember(memberId);
        for (Reminder reminder : affected) {
            reminder.getTargetMembers().removeIf(member -> memberId.equals(member.getId()));
            if (reminder.getTargetMember() != null && memberId.equals(reminder.getTargetMember().getId())) {
                reminder.setTargetMember(null);
            }
            if (reminder.effectiveMembers().isEmpty()) {
                reminder.setActive(false);
                reminder.setNextFireAt(null);
            }
            reminder.setUpdatedAt(now);
        }
        saveAll(affected);
        return affected.size();
    }

    Optional<Reminder> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("""
        select r from Reminder r
        left join fetch r.targetPosition
        left join fetch r.targetMember tm
        left join fetch tm.user
        left join fetch tm.position
        left join fetch r.createdByMember cb
        left join fetch cb.user
        left join fetch cb.position
        where r.restaurant.id = :restaurantId
        """)
    List<Reminder> findDetailedByRestaurantId(@Param("restaurantId") Long restaurantId);

    @Query("""
        select r from Reminder r
        left join fetch r.targetPosition
        left join fetch r.targetMember tm
        left join fetch tm.user
        left join fetch tm.position
        left join fetch r.createdByMember cb
        left join fetch cb.user
        left join fetch cb.position
        where r.restaurant.id = :restaurantId
          and r.active = true
          and r.nextFireAt is not null
          and r.nextFireAt <= :now
        """)
    List<Reminder> findDueReminders(@Param("restaurantId") Long restaurantId, @Param("now") Instant now);
}
