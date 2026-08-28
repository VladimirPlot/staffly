package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamAttempt;

import jakarta.persistence.LockModeType;

import java.util.List;
import java.util.Collection;
import java.util.Optional;

public interface TrainingExamAttemptRepository extends JpaRepository<TrainingExamAttempt, Long> {
    @Query("""
            select a from TrainingExamAttempt a
            join fetch a.assignment assignment
            join fetch assignment.exam exam
            where a.finishedAt is null
              and assignment.active = true
              and assignment.restaurant.id = :restaurantId
              and exam.id in :examIds
              and exam.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and a.examVersion = assignment.examVersionSnapshot
            order by assignment.id, a.startedAt desc, a.id desc
            """)
    List<TrainingExamAttempt> findUnfinishedForActiveObligationsAnalyticsScope(
            @Param("restaurantId") Long restaurantId,
            @Param("examIds") Collection<Long> examIds
    );

    @Query("""
            select a from TrainingExamAttempt a
            join fetch a.assignment assignment
            join assignment.exam exam
            where a.finishedAt is not null
              and a.cancellationReason is null
              and assignment.active = true
              and assignment.restaurant.id = :restaurantId
              and exam.id in :examIds
              and exam.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and a.examVersion = assignment.examVersionSnapshot
            order by assignment.id, a.finishedAt desc, a.id desc
            """)
    List<TrainingExamAttempt> findFinishedForActiveObligationsAnalyticsScope(
            @Param("restaurantId") Long restaurantId,
            @Param("examIds") Collection<Long> examIds
    );

    boolean existsByExamIdAndRestaurantIdAndUserIdAndFinishedAtIsNull(Long examId, Long restaurantId, Long userId);

    boolean existsByAssignmentIdAndFinishedAtIsNull(Long assignmentId);

    @Query("""
            select a from TrainingExamAttempt a
            where a.assignment.id in :assignmentIds and a.finishedAt is not null
              and a.cancellationReason is null
            order by a.assignment.id, a.finishedAt desc, a.id desc
            """)
    List<TrainingExamAttempt> findCountedFinishedByAssignmentIdIn(
            @Param("assignmentIds") Collection<Long> assignmentIds);

    List<TrainingExamAttempt> findByAssignmentIdInAndFinishedAtIsNullOrderByAssignmentIdAscStartedAtDescIdDesc(
            Collection<Long> assignmentIds);

    List<TrainingExamAttempt> findByExamIdAndRestaurantIdAndUserIdAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
            Long examId,
            Long restaurantId,
            Long userId
    );

    Optional<TrainingExamAttempt> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAttempt a
            where a.id = :attemptId and a.restaurant.id = :restaurantId
            """)
    Optional<TrainingExamAttempt> findByIdAndRestaurantIdForFinalizationUpdate(
            @Param("attemptId") Long attemptId,
            @Param("restaurantId") Long restaurantId
    );

    @Modifying(flushAutomatically = true)
    @Query("""
            update TrainingExamAttempt a set a.assignment = null
            where a.assignment.exam.id = :examId
            """)
    int detachAssignmentsForExam(@Param("examId") Long examId);

    @Query(value = """
        select x.exam_id as examId,
               x.last_attempt_at as lastAttemptAt,
               x.score_percent as scorePercent
        from (
            select e.id as exam_id,
                   a.last_attempt_at,
                   a.score_percent
            from training_exam e
            join lateral (
                select coalesce(at.finished_at, at.started_at) as last_attempt_at,
                       at.score_percent
                from training_exam_attempt at
                where at.restaurant_id = :restaurantId
                  and at.user_id = :userId
                  and at.exam_id = e.id
                  and at.exam_version = e.version
                  and at.passed = true
                order by coalesce(at.finished_at, at.started_at) desc, at.id desc
                limit 1
            ) a on true
            where e.restaurant_id = :restaurantId
              and e.id in (:examIds)
        ) x
        """, nativeQuery = true)
    List<TrainingExamProgressProjection> findCurrentPassedProgressByRestaurantAndUserAndExamIds(
            @Param("restaurantId") Long restaurantId,
            @Param("userId") Long userId,
            @Param("examIds") List<Long> examIds
    );

    long countByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNotNull(
            Long examId,
            Long restaurantId,
            Long userId,
            int examVersion
    );

    Optional<TrainingExamAttempt> findTopByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
            Long examId, Long restaurantId, Long userId, int examVersion
    );

    Optional<TrainingExamAttempt> findTopByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
            Long assignmentId,
            int examVersion
    );

    List<TrainingExamAttempt> findByAssignmentIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
            Long assignmentId,
            int examVersion
    );

    @Query("""
            select a from TrainingExamAttempt a
            where a.assignment.id = :assignmentId and a.examVersion = :examVersion
              and a.finishedAt is not null and a.cancellationReason is null
            order by a.finishedAt desc, a.id desc
            """)
    List<TrainingExamAttempt> findCountedFinishedByAssignmentAndVersion(
            @Param("assignmentId") Long assignmentId, @Param("examVersion") int examVersion);

    List<TrainingExamAttempt> findByExamIdAndRestaurantIdAndUserIdOrderByStartedAtDesc(Long examId, Long restaurantId, Long userId);

    @Query("""
            select a from TrainingExamAttempt a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.user.id = :userId
              and a.examVersion = :examVersion
              and a.finishedAt is null
              and (
                (:assignmentId is null and a.assignment is null)
                or a.assignment.id = :assignmentId
              )
            order by a.startedAt desc, a.id desc
            """)
    Optional<TrainingExamAttempt> findTopUnfinishedForStartContext(@Param("examId") Long examId,
                                                                   @Param("restaurantId") Long restaurantId,
                                                                   @Param("userId") Long userId,
                                                                   @Param("examVersion") int examVersion,
                                                                   @Param("assignmentId") Long assignmentId);

    Optional<TrainingExamAttempt> findTopByAssignmentIdAndExamVersionAndPassedTrueAndFinishedAtIsNotNullOrderByFinishedAtAscIdAsc(
            Long assignmentId,
            int examVersion
    );
}
