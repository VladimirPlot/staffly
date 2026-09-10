package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.schedule.model.ScheduleChange;

import java.util.List;

public interface ScheduleChangeRepository extends JpaRepository<ScheduleChange, Long> {
    @EntityGraph(attributePaths = "items")
    List<ScheduleChange> findByScheduleIdOrderByCreatedAtDescIdDesc(Long scheduleId);
}
