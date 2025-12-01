package ru.staffly.notification.dto;

public record NotificationAuthorDto(
        Long id,
        String name,
        String firstName,
        String lastName
) {}