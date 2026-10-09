package ru.staffly.announcement.dto;

import java.time.Instant;
import java.util.List;

public record AnnouncementDto(
        Long id,
        String content,
        Instant createdAt,
        AnnouncementAuthorDto createdBy,
        List<AnnouncementPositionDto> positions
) {
}
