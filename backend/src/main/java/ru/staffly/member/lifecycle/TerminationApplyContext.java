package ru.staffly.member.lifecycle;

import java.time.Instant;
import java.util.UUID;
import ru.staffly.member.model.RestaurantMember;

public record TerminationApplyContext(Long restaurantId, Long actorUserId, RestaurantMember target,
                                      TerminationMode mode, Instant now, UUID operationId) { }
