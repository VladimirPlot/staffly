package ru.staffly.announcement.dto;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

public record AnnouncementDto(
        Long id,
        String content,
        LocalDate expiresAt,
        Instant createdAt,
        Instant updatedAt,
        AnnouncementAuthorDto createdBy,
        List<AnnouncementPositionDto> positions
) {
}