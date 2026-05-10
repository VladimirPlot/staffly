package ru.staffly.member.responsibility;

import java.util.List;

public record MemberResponsibilityGroupDto(
        MemberResponsibilityType type,
        String title,
        List<MemberResponsibilityItemDto> items
) {
}
