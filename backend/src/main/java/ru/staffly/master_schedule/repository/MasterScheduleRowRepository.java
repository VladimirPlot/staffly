package ru.staffly.master_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.master_schedule.model.MasterScheduleRow;

import java.util.List;

public interface MasterScheduleRowRepository extends JpaRepository<MasterScheduleRow, Long> {
    List<MasterScheduleRow> findByScheduleId(Long scheduleId);

    List<MasterScheduleRow> findByScheduleIdAndPositionId(Long scheduleId, Long positionId);

    long countByScheduleIdAndPositionId(Long scheduleId, Long positionId);
}
