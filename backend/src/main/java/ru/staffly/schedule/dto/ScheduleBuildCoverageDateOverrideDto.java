package ru.staffly.schedule.dto;

import java.time.LocalDate;

public record ScheduleBuildCoverageDateOverrideDto(
        Long id,
        LocalDate date,
        Integer shiftOptionIndex,
        Integer requiredCount
) {}
