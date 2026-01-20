package ru.staffly.master_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.master_schedule.model.MasterScheduleWeekTemplate;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;

public interface MasterScheduleWeekTemplateRepository extends JpaRepository<MasterScheduleWeekTemplate, Long> {
    List<MasterScheduleWeekTemplate> findByScheduleId(Long scheduleId);

    Optional<MasterScheduleWeekTemplate> findByScheduleIdAndPositionIdAndWeekday(
            Long scheduleId,
            Long positionId,
            DayOfWeek weekday
    );

    void deleteByScheduleIdAndPositionId(Long scheduleId, Long positionId);
}
