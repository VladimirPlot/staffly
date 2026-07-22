package ru.staffly.schedule.dto;

import java.time.LocalDate;

public record SaveScheduleBuildCoverageDateOverrideRequest(
        LocalDate date,
        Long shiftOptionId,
        Integer requiredCount
) {}
