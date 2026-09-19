package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.schedule.model.ScheduleParticipation;

import java.util.List;
import java.util.Optional;

public interface ScheduleParticipationRepository extends JpaRepository<ScheduleParticipation, Long> {
    boolean existsByScheduleIdAndMemberId(Long scheduleId, Long memberId);

    @EntityGraph(attributePaths = {"member", "member.user"})
    Optional<ScheduleParticipation> findByScheduleIdAndMemberId(Long scheduleId, Long memberId);

    @EntityGraph(attributePaths = {"member", "member.user"})
    List<ScheduleParticipation> findByScheduleIdOrderById(Long scheduleId);

    long deleteByScheduleIdAndMemberId(Long scheduleId, Long memberId);

    long deleteByScheduleId(Long scheduleId);
}
