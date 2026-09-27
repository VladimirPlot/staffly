package ru.staffly.member.responsibility;

import java.util.List;

public record MemberResponsibilityItemDto(
        Long id,
        Long version,
        String title,
        String subtitle,
        MemberResponsibilityPeriodDto period,
        List<MemberResponsibilityCandidateDto> candidates
) {
}
