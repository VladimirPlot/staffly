package ru.staffly.master_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.master_schedule.model.MasterSchedule;

import java.util.List;
import java.util.Optional;

public interface MasterScheduleRepository extends JpaRepository<MasterSchedule, Long> {
    List<MasterSchedule> findByRestaurantIdAndDeletedAtIsNull(Long restaurantId);

    Optional<MasterSchedule> findByIdAndDeletedAtIsNull(Long id);
}