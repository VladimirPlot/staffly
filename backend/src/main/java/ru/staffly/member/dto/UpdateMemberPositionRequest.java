package ru.staffly.member.dto;

import jakarta.annotation.Nullable;

public record UpdateMemberPositionRequest(
        @Nullable Long positionId
) {}