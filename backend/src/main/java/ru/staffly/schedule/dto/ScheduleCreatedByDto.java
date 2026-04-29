package ru.staffly.schedule.dto;

public record ScheduleCreatedByDto(
        Long userId,
        String displayName
) {}
