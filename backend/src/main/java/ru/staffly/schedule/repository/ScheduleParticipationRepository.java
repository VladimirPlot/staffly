package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.schedule.model.ScheduleParticipation;

import java.util.List;
import java.util.Optional;

/**
 * Schedule owns participation through cascade and orphanRemoval. Lifecycle removal must
 * mutate the managed Schedule.participations collection; an independent repository delete
 * leaves the child reachable and allows Hibernate's cascade to cancel the deletion.
 */
public interface ScheduleParticipationRepository extends JpaRepository<ScheduleParticipation, Long> {
    boolean existsByScheduleIdAndMemberId(Long scheduleId, Long memberId);

    @EntityGraph(attributePaths = {"member", "member.user"})
    Optional<ScheduleParticipation> findByScheduleIdAndMemberId(Long scheduleId, Long memberId);

    @EntityGraph(attributePaths = {"member", "member.user", "member.position"})
    List<ScheduleParticipation> findByScheduleIdOrderById(Long scheduleId);

    long deleteByScheduleId(Long scheduleId);
}
