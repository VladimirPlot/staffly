package ru.staffly.schedule.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position"})
    List<Schedule> findByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"rows", "ownerMember", "ownerMember.user", "ownerMember.position", "createdByUser"})
    Optional<Schedule> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Schedule s where s.id = :id and s.restaurant.id = :restaurantId")
    Optional<Schedule> findForUpdateByIdAndRestaurantId(@Param("id") Long id,
                                                         @Param("restaurantId") Long restaurantId);

    boolean existsByPreferenceBuildTemplateIdAndStatus(Long templateId, ScheduleStatus status);

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position", "ownerUser"})
    List<Schedule> findByRestaurantIdAndOwnerUserIdAndEndDateGreaterThanEqualOrderByStartDateAsc(
            Long restaurantId,
            Long ownerUserId,
            LocalDate endDate
    );

    @Query("select s.title from Schedule s where s.restaurant.id = :restaurantId")
    List<String> findTitlesByRestaurantId(@Param("restaurantId") Long restaurantId);

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position"})
    @Query("""
            select distinct s from Schedule s join s.positions p
            where s.restaurant.id = :restaurantId and p.id = :positionId
            order by s.createdAt desc
            """)
    List<Schedule> findByRestaurantIdAndPositionId(@Param("restaurantId") Long restaurantId,
                                                   @Param("positionId") Long positionId);
}
