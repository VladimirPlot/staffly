package ru.staffly.reminder.dto;

public record ReminderMemberDto(
        Long id,
        Long userId,
        String fullName,
        String firstName,
        String lastName,
        Long positionId,
        String positionName
) {
}
