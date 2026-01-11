package ru.staffly.announcement.dto;

public record AnnouncementAuthorDto(
        Long id,
        String name,
        String firstName,
        String lastName
) {
}