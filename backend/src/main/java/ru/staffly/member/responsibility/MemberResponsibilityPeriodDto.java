package ru.staffly.member.responsibility;

import java.time.LocalDate;

public record MemberResponsibilityPeriodDto(
        LocalDate startDate,
        LocalDate endDate
) {
}
