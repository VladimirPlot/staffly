package ru.staffly.announcement.dto;

import java.time.LocalDate;
import java.util.List;

public record AnnouncementRequest(
        String content,
        LocalDate expiresAt,
        List<Long> positionIds
) {
}