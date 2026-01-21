package ru.staffly.master_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.master_schedule.model.MasterScheduleWeekTemplatePosition;

import java.util.List;
import java.util.Optional;

public interface MasterScheduleWeekTemplatePositionRepository extends JpaRepository<MasterScheduleWeekTemplatePosition, Long> {
    List<MasterScheduleWeekTemplatePosition> findByScheduleId(Long scheduleId);

    Optional<MasterScheduleWeekTemplatePosition> findByScheduleIdAndPositionId(Long scheduleId, Long positionId);

    void deleteByScheduleIdAndPositionId(Long scheduleId, Long positionId);
}
