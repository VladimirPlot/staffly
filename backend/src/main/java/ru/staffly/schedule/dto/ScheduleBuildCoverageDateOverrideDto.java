package ru.staffly.schedule.dto;

import java.time.LocalDate;

public record ScheduleBuildCoverageDateOverrideDto(
        Long id,
        LocalDate date,
        Long shiftOptionId,
        Integer requiredCount
) {}
