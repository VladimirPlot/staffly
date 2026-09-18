package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ScheduleParticipationService {
    private final ScheduleRepository schedules;
    private final RestaurantMemberRepository members;
    private final ScheduleParticipationRepository participations;

    @Transactional(readOnly = true)
    public boolean isParticipant(Long scheduleId, Long memberId) {
        return participations.existsByScheduleIdAndMemberId(scheduleId, memberId);
    }

    @Transactional(readOnly = true)
    public List<RestaurantMember> findParticipants(Long scheduleId) {
        return participations.findByScheduleIdOrderById(scheduleId).stream()
                .map(ScheduleParticipation::getMember).toList();
    }

    @Transactional
    public ScheduleParticipation add(Long restaurantId, Long scheduleId, Long memberId) {
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        RestaurantMember member = members.findById(memberId)
                .filter(value -> Objects.equals(value.getRestaurant().getId(), restaurantId))
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (member.getPosition() == null) {
            throw new BadRequestException("Participant must have a position");
        }
        ScheduleParticipation existing = participations.findByScheduleIdOrderById(scheduleId).stream()
                .filter(value -> Objects.equals(value.getMember().getId(), memberId)).findFirst().orElse(null);
        if (existing != null) return existing;
        schedule.setUpdatedAt(TimeProvider.now());
        return participations.save(newParticipation(schedule, member));
    }

    @Transactional
    public boolean remove(Long restaurantId, Long scheduleId, Long memberId) {
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        boolean removed = participations.deleteByScheduleIdAndMemberId(scheduleId, memberId) > 0;
        if (removed) schedule.setUpdatedAt(TimeProvider.now());
        return removed;
    }

    public static ScheduleParticipation newParticipation(Schedule schedule, RestaurantMember member) {
        return ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(member.getPosition().getId()).positionName(member.getPosition().getName()).build();
    }
}
