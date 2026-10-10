package ru.staffly.member.lifecycle;

import java.time.Instant;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;

public record PositionChangePreviewContext(Long restaurantId, Long actorUserId, RestaurantMember member,
        Position currentPosition, Position targetPosition, Instant now) { }
