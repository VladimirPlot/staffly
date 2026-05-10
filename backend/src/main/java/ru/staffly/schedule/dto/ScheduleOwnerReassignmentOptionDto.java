package ru.staffly.schedule.dto;

import java.util.List;

public record ScheduleOwnerReassignmentOptionDto(
        Long scheduleId,
        String scheduleTitle,
        String startDate,
        String endDate,
        ScheduleOwnerDto currentOwner,
        List<ScheduleOwnerDto> candidates
) {}