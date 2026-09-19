package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.model.SchedulePositionIds;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;

import java.util.Collection;
import java.util.LinkedHashMap;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

/**
 * The single participation-snapshot boundary. Callers must hold member locks
 * (ascending id) before the Schedule aggregate lock.
 */
@Component
@RequiredArgsConstructor
public class ScheduleParticipationCreator {
    private final ScheduleParticipationRepository participations;

    public CreationResult createWithLocksHeld(Schedule schedule, RestaurantMember member,
                                               boolean requireSupportedPosition) {
        return participations.findByScheduleIdAndMemberId(schedule.getId(), member.getId())
                .map(existing -> new CreationResult(existing, false))
                .orElseGet(() -> {
                    validateEligibility(schedule, member, requireSupportedPosition);
                    return new CreationResult(participations.save(snapshot(schedule, member)), true);
                });
    }

    public Map<Long, ScheduleParticipation> createMissingWithLocksHeld(
            Schedule schedule, Collection<RestaurantMember> members, boolean requireSupportedPosition) {
        Map<Long, ScheduleParticipation> byMemberId = participations.findByScheduleIdOrderById(schedule.getId()).stream()
                .collect(Collectors.toMap(value -> value.getMember().getId(), value -> value,
                        (left, right) -> left, LinkedHashMap::new));
        members.stream().sorted(java.util.Comparator.comparing(RestaurantMember::getId)).forEach(member -> {
            if (!byMemberId.containsKey(member.getId())) {
                validateEligibility(schedule, member, requireSupportedPosition);
                byMemberId.put(member.getId(), participations.save(snapshot(schedule, member)));
            }
        });
        return byMemberId;
    }

    /** Validates participation eligibility without persisting any child row. */
    void validateEligibility(Schedule schedule, RestaurantMember member, boolean requireSupportedPosition) {
        if (!Objects.equals(schedule.getRestaurant().getId(), member.getRestaurant().getId())) {
            throw new BadRequestException("Participant must belong to the Schedule restaurant");
        }
        if (member.getPosition() == null) {
            throw new BadRequestException("Participant must have a position");
        }
        if (requireSupportedPosition && !SchedulePositionIds.ids(schedule).contains(member.getPosition().getId())) {
            throw new BadRequestException("Participant position is not supported by the Schedule");
        }
    }

    private ScheduleParticipation snapshot(Schedule schedule, RestaurantMember member) {
        return ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(member.getPosition().getId())
                .positionName(member.getPosition().getName()).build();
    }

    public record CreationResult(ScheduleParticipation participation, boolean created) {}
}
