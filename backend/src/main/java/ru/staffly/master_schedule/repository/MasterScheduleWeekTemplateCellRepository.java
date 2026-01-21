package ru.staffly.master_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.master_schedule.model.MasterScheduleWeekTemplateCell;

import java.time.DayOfWeek;
import java.util.List;
import java.util.Optional;

public interface MasterScheduleWeekTemplateCellRepository extends JpaRepository<MasterScheduleWeekTemplateCell, Long> {
    List<MasterScheduleWeekTemplateCell> findByScheduleId(Long scheduleId);

    Optional<MasterScheduleWeekTemplateCell> findByScheduleIdAndPositionIdAndWeekday(
            Long scheduleId,
            Long positionId,
            DayOfWeek weekday
    );

    void deleteByScheduleIdAndPositionId(Long scheduleId, Long positionId);
}
