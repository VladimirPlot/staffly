package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.data.domain.PageRequest;
import org.springframework.stereotype.Service;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.schedule.dto.ScheduleAuditLogDto;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.model.ScheduleAuditLog;
import ru.staffly.schedule.repository.ScheduleAuditLogRepository;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.HashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScheduleAuditService {

    private final ScheduleAuditLogRepository auditLogs;
    private final UserRepository users;

    public void record(Schedule schedule, Long actorUserId, ScheduleAuditAction action, String details) {
        if (schedule == null || action == null) {
            return;
        }
        auditLogs.save(ScheduleAuditLog.builder()
                .schedule(schedule)
                .actorUserId(actorUserId)
                .action(action)
                .details(details)
                .createdAt(TimeProvider.now())
                .build());
    }

    public List<ScheduleAuditLogDto> getRecentHistory(Schedule schedule, int limit) {
        if (schedule == null || schedule.getId() == null || limit <= 0) {
            return List.of();
        }
        List<ScheduleAuditLog> logs = auditLogs.findByScheduleIdOrderByCreatedAtDesc(
                schedule.getId(),
                PageRequest.of(0, limit)
        );
        if (logs.isEmpty()) {
            return List.of();
        }
        Set<Long> actorUserIds = logs.stream()
                .map(ScheduleAuditLog::getActorUserId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        Map<Long, User> usersById = actorUserIds.isEmpty()
                ? new HashMap<>()
                : users.findAllById(actorUserIds).stream()
                .collect(Collectors.toMap(User::getId, Function.identity()));
        return logs.stream()
                .map(log -> {
                    User actor = log.getActorUserId() != null ? usersById.get(log.getActorUserId()) : null;
                    return new ScheduleAuditLogDto(
                            log.getId(),
                            log.getAction().name(),
                            log.getActorUserId(),
                            actor != null ? actor.getFullName() : null,
                            log.getDetails(),
                            log.getCreatedAt()
                    );
                })
                .toList();
    }
}