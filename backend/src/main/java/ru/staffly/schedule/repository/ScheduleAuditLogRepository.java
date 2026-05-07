package ru.staffly.schedule.repository;

import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.schedule.model.ScheduleAuditLog;

import java.util.List;

public interface ScheduleAuditLogRepository extends JpaRepository<ScheduleAuditLog, Long> {
    List<ScheduleAuditLog> findByScheduleIdOrderByCreatedAtDesc(Long scheduleId, Pageable pageable);
}