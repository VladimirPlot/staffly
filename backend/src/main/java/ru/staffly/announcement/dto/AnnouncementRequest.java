package ru.staffly.announcement.dto;

import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Positive;
import jakarta.validation.constraints.Size;

import java.util.List;

public record AnnouncementRequest(
        @NotBlank
        @Size(max = 2000)
        String content,
        @NotNull
        AnnouncementAudience audience,
        List<@NotNull @Positive Long> positionIds,
        List<@NotNull @Positive Long> memberIds
) {
}
