package ru.staffly.reminder.dto;

public record ReminderDto(
        Long id,
        Long restaurantId,
        String title,
        String description,
        boolean visibleToAdmin,
        String targetType,
        ReminderPositionDto targetPosition,
        ReminderMemberDto targetMember,
        String periodicity,
        String time,
        Integer dayOfWeek,
        Integer dayOfMonth,
        boolean monthlyLastDay,
        String onceDate,
        String nextFireAt,
        boolean active,
        ReminderMemberDto createdBy
) {
}
