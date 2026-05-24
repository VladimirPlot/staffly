package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.Schedule;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    @EntityGraph(attributePaths = {"ownerMember", "ownerMember.user", "ownerMember.position"})
    List<Schedule> findByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"rows", "ownerMember", "ownerMember.user", "ownerMember.position", "createdByUser"})
    Optional<Schedule> findByIdAndRestaurantId(Long id, Long restaurantId);

    @EntityGraph(attributePaths = {"ownerMember", "ownerMember.user", "ownerMember.position", "ownerUser"})
    List<Schedule> findByRestaurantIdAndOwnerUserIdAndEndDateGreaterThanEqualOrderByStartDateAsc(
            Long restaurantId,
            Long ownerUserId,
            LocalDate endDate
    );

    @Query("select s.title from Schedule s where s.restaurant.id = :restaurantId")
    List<String> findTitlesByRestaurantId(@Param("restaurantId") Long restaurantId);
}
