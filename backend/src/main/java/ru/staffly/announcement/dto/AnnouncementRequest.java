package ru.staffly.announcement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotEmpty;
import jakarta.validation.constraints.Size;

import java.time.LocalDate;
import java.util.List;

public record AnnouncementRequest(
        @NotBlank
        @Size(max = 2000)
        String content,
        LocalDate expiresAt,
        @NotEmpty
        List<Long> positionIds
) {
}