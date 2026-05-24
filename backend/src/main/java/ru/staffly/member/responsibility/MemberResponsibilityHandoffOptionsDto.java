package ru.staffly.member.responsibility;

import java.util.List;

public record MemberResponsibilityHandoffOptionsDto(
        Long userId,
        String fullName,
        List<MemberResponsibilityGroupDto> groups
) {
}
