package ru.staffly.schedule.dto;

public record ScheduleDayDto(
        String date,
        String weekdayLabel,
        String dayNumber
) {}