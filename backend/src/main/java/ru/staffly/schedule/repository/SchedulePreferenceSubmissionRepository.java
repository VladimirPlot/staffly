package ru.staffly.schedule.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;

import java.util.List;
import java.util.Optional;

public interface SchedulePreferenceSubmissionRepository extends JpaRepository<SchedulePreferenceSubmission, Long> {

    Optional<SchedulePreferenceSubmission> findByScheduleIdAndMemberId(Long scheduleId, Long memberId);

    @EntityGraph(attributePaths = {"cells", "member", "member.user", "member.position"})
    @Query("""
           select distinct s from SchedulePreferenceSubmission s
           where s.schedule.id = :scheduleId and s.member.id = :memberId
           """)
    Optional<SchedulePreferenceSubmission> findWithCellsByScheduleIdAndMemberId(@Param("scheduleId") Long scheduleId,
                                                                                 @Param("memberId") Long memberId);

    @EntityGraph(attributePaths = {"cells", "member", "member.user", "member.position"})
    @Query("""
           select distinct s from SchedulePreferenceSubmission s
           where s.schedule.id = :scheduleId
           """)
    List<SchedulePreferenceSubmission> findWithCellsByScheduleId(@Param("scheduleId") Long scheduleId);

    @Query("""
           select s from SchedulePreferenceSubmission s
           join fetch s.member m
           where s.schedule.id = :scheduleId
           """)
    List<SchedulePreferenceSubmission> findByScheduleIdWithMember(@Param("scheduleId") Long scheduleId);


    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
           select s from SchedulePreferenceSubmission s
           where s.schedule.id = :scheduleId and s.member.id = :memberId
           """)
    Optional<SchedulePreferenceSubmission> findForUpdateByScheduleIdAndMemberId(@Param("scheduleId") Long scheduleId,
                                                                                 @Param("memberId") Long memberId);
}
