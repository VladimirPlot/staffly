package ru.staffly.master_schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.master_schedule.model.MasterScheduleCell;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface MasterScheduleCellRepository extends JpaRepository<MasterScheduleCell, Long> {
    Optional<MasterScheduleCell> findByRowIdAndWorkDate(Long rowId, LocalDate workDate);

    List<MasterScheduleCell> findByRowScheduleId(Long scheduleId);

    List<MasterScheduleCell> findByRowScheduleIdAndWorkDate(Long scheduleId, LocalDate workDate);

    List<MasterScheduleCell> findByRowScheduleIdAndWorkDateBetween(Long scheduleId, LocalDate start, LocalDate end);
}