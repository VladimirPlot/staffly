package ru.staffly.schedule.dto;

import jakarta.validation.constraints.Max;
import jakarta.validation.constraints.Min;
import jakarta.validation.constraints.NotNull;
import ru.staffly.schedule.model.CanonicalBusinessInterval;

import java.time.LocalTime;

public record ScheduleCellShiftDto(
        @NotNull LocalTime startTime,
        @NotNull @Min(0) @Max(1) Integer startDayOffset,
        @NotNull LocalTime endTime,
        @NotNull @Min(0) @Max(1) Integer endDayOffset
) {
    public CanonicalBusinessInterval toInterval() {
        return new CanonicalBusinessInterval(startTime, startDayOffset, endTime, endDayOffset);
    }

    public static ScheduleCellShiftDto from(CanonicalBusinessInterval interval) {
        return new ScheduleCellShiftDto(interval.startTime(), interval.startDayOffset(),
                interval.endTime(), interval.endDayOffset());
    }
}
