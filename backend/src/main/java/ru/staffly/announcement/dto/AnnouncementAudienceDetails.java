package ru.staffly.announcement.dto;

import java.util.List;

/** Saved at send time; history does not follow subsequent membership or name changes. */
public record AnnouncementAudienceDetails(
        AnnouncementAudience audience,
        long recipientCount,
        List<AnnouncementMemberDto> recipients,
        List<AnnouncementPositionDto> positions,
        AnnouncementAuthorDto author
) {
}
