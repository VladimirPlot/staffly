package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;

import java.util.List;

@Service
@RequiredArgsConstructor
public class ScheduleParticipationService {
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

}
