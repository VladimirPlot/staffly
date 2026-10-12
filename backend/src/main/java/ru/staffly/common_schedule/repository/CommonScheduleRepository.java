package ru.staffly.common_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.common_schedule.model.CommonSchedule;

import java.util.List;
import java.util.Optional;

public interface CommonScheduleRepository extends JpaRepository<CommonSchedule, Long> {
    List<CommonSchedule> findByRestaurantIdOrderByIdDesc(Long restaurantId);
    Optional<CommonSchedule> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("select distinct c from CommonSchedule c join c.sources s where s.id = :scheduleId")
    List<CommonSchedule> findDependingOn(@Param("scheduleId") Long scheduleId);
}
