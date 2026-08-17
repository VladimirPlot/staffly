package ru.staffly.schedule.dto;

import java.time.LocalDate;

public record SaveScheduleBuildCoverageDateOverrideRequest(
        LocalDate date,
        Integer shiftOptionIndex,
        Integer requiredCount
) {}
