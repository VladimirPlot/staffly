package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleParticipationService {
    private final ScheduleRepository schedules;
    private final RestaurantMemberRepository members;
    private final ScheduleParticipationRepository participations;
    private final ScheduleParticipationCreator creator;

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
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        ScheduleParticipationCreator.CreationResult result = creator.createWithLocksHeld(schedule, member, false);
        if (result.created()) schedule.setUpdatedAt(TimeProvider.now());
        return result.participation();
    }

    @Transactional
    public boolean remove(Long restaurantId, Long scheduleId, Long memberId) {
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        boolean removed = participations.deleteByScheduleIdAndMemberId(scheduleId, memberId) > 0;
        if (removed) schedule.setUpdatedAt(TimeProvider.now());
        return removed;
    }

}
