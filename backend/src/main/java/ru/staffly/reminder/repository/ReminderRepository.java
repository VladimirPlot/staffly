package ru.staffly.reminder.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.reminder.model.Reminder;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

public interface ReminderRepository extends JpaRepository<Reminder, Long> {

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
