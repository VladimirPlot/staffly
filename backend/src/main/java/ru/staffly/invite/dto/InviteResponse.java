package ru.staffly.invite.dto;

import ru.staffly.invite.model.InvitationStatus;

import java.time.Instant;

public record InviteResponse(
        Long id,
        Long restaurantId,
        String phoneOrEmail,
        String token,
        InvitationStatus status,
        Instant expiresAt,
        Long invitedByUserId,
        Instant createdAt
) {}