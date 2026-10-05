package ru.staffly.member.lifecycle;

import java.time.Instant;
import ru.staffly.member.model.RestaurantMember;

/** HTTP-independent immutable operation context. CREATOR actors are represented by user id. */
public record TerminationPreviewContext(Long restaurantId, Long actorUserId,
                                        RestaurantMember target, Instant now) { }
