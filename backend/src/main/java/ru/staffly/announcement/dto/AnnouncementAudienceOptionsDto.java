package ru.staffly.announcement.dto;

import java.util.List;

public record AnnouncementAudienceOptionsDto(
        List<AnnouncementPositionDto> positions,
        List<AnnouncementMemberDto> members
) {
}
