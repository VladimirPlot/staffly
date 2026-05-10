package ru.staffly.member.responsibility;

import java.util.List;

public record MemberResponsibilityItemDto(
        Long id,
        String title,
        String subtitle,
        MemberResponsibilityPeriodDto period,
        List<MemberResponsibilityCandidateDto> candidates
) {
}
