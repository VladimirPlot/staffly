package ru.staffly.schedule.dto;

import java.time.Instant;
import java.util.List;

public record ScheduleChangeDto(Long changeId, Long actorUserId, String actorName, Instant createdAt,
                                List<ScheduleChangeItemDto> items) {}
