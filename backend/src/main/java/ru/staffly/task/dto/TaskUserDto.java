package ru.staffly.task.dto;

public record TaskUserDto(
        Long id,
        String fullName,
        String firstName,
        String lastName,
        Long positionId,
        String positionName
) {
}