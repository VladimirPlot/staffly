package ru.staffly.member.responsibility;

import jakarta.validation.Valid;
import jakarta.validation.constraints.NotNull;

import java.util.List;

public record MemberResponsibilityHandoffRequest(
        List<@Valid Item> items
) {
    public record Item(
            @NotNull MemberResponsibilityType type,
            @NotNull Long resourceId,
            @NotNull Long newOwnerUserId
    ) {
    }
}
