package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamAssignment;

import jakarta.persistence.LockModeType;
import java.util.Collection;
import java.util.List;
import java.util.Optional;
import ru.staffly.training.model.TrainingExamAssignmentStatus;
import ru.staffly.training.model.TrainingExamAssignmentDeactivationReason;

public interface TrainingExamAssignmentRepository extends JpaRepository<TrainingExamAssignment, Long> {
    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = """
            update training_exam_assignment
            set replaced_by_assignment_id = null
            where replaced_by_assignment_id in (
                select id from training_exam_assignment where exam_id = :examId
            )
            """, nativeQuery = true)
    int detachReplacementLinksToExam(@Param("examId") Long examId);

    @Modifying(flushAutomatically = true, clearAutomatically = true)
    @Query(value = "delete from training_exam_assignment where exam_id = :examId", nativeQuery = true)
    int deleteAllForPermanentExamDeletion(@Param("examId") Long examId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.id = :assignmentId and a.restaurant.id = :restaurantId
            """)
    Optional<TrainingExamAssignment> findByIdAndRestaurantIdForFinalizationUpdate(
            @Param("assignmentId") Long assignmentId,
            @Param("restaurantId") Long restaurantId
    );

    @Query("""
            select a from TrainingExamAssignment a
            left join fetch a.user u
            left join fetch a.assignedPosition ap
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = true
            """)
    List<TrainingExamAssignment> findActiveByExamIdAndRestaurantId(@Param("examId") Long examId,
                                                                   @Param("restaurantId") Long restaurantId);

    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId and a.restaurant.id = :restaurantId and a.user.id = :userId
              and a.active = true
            """)
    Optional<TrainingExamAssignment> findCurrentActiveByExamAndUser(@Param("examId") Long examId,
                                                                    @Param("restaurantId") Long restaurantId,
                                                                    @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.user.id = :userId
              and a.active = true
            """)
    Optional<TrainingExamAssignment> findCurrentActiveForMutation(@Param("examId") Long examId,
                                                                   @Param("restaurantId") Long restaurantId,
                                                                   @Param("userId") Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.user.id = :userId
              and a.active = true
            """)
    Optional<TrainingExamAssignment> findActiveForStartUpdate(@Param("examId") Long examId,
                                                              @Param("restaurantId") Long restaurantId,
                                                              @Param("userId") Long userId);

    List<TrainingExamAssignment> findByExamIdAndRestaurantIdAndExamVersionSnapshot(Long examId,
                                                                                   Long restaurantId,
                                                                                   int examVersionSnapshot);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId and a.restaurant.id = :restaurantId
              and a.examVersionSnapshot = :examVersion
            order by a.id
            """)
    List<TrainingExamAssignment> findCurrentVersionForLifecycleUpdate(@Param("examId") Long examId,
                                                                      @Param("restaurantId") Long restaurantId,
                                                                      @Param("examVersion") int examVersion);

    List<TrainingExamAssignment> findByExamIdAndRestaurantIdAndExamVersionSnapshotAndActiveTrue(
            Long examId,
            Long restaurantId,
            int examVersionSnapshot
    );

    @Query("""
            select coalesce(max(a.resetGeneration), -1) from TrainingExamAssignment a
            where a.exam.id = :examId and a.user.id = :userId
              and a.examVersionSnapshot = :examVersion
            """)
    int findMaxResetGeneration(@Param("examId") Long examId,
                               @Param("userId") Long userId,
                               @Param("examVersion") int examVersion);

    @Query("""
            select coalesce(max(a.resetGeneration), -1) from TrainingExamAssignment a
            where a.assignmentCycle.id = :cycleId and a.user.id = :userId
            """)
    int findMaxResetGenerationInCycle(@Param("cycleId") Long cycleId,
                                      @Param("userId") Long userId);

    Optional<TrainingExamAssignment> findTopByExamIdAndRestaurantIdAndUserIdOrderByActiveDescAssignedAtDescIdDesc(
            Long examId,
            Long restaurantId,
            Long userId
    );

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId and a.restaurant.id = :restaurantId and a.user.id = :userId
              and a.assessmentSpecification.id = :specificationId
              and a.assignmentCycle.id = :cycleId
              and a.active = false
              and a.deactivationReason = ru.staffly.training.model.TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED
            order by a.resetGeneration desc, a.id desc
            """)
    List<TrainingExamAssignment> findAudienceRemovedForExactCycle(
            @Param("examId") Long examId, @Param("restaurantId") Long restaurantId,
            @Param("userId") Long userId, @Param("specificationId") Long specificationId,
            @Param("cycleId") Long cycleId);

    Optional<TrainingExamAssignment> findTopByExamIdAndRestaurantIdAndUserIdAndPassedAtIsNotNullOrderByPassedAtDescIdDesc(
            Long examId, Long restaurantId, Long userId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = true
            order by a.id
            """)
    List<TrainingExamAssignment> findAllActiveAssignmentsForCycleTransition(@Param("examId") Long examId,
                                                                             @Param("restaurantId") Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.replacedByAssignment is null
              and (a.active = true or (a.active = false
                and a.deactivationReason = ru.staffly.training.model.TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN))
            order by a.id
            """)
    List<TrainingExamAssignment> findLifecyclePredecessorCandidatesForRecertification(
            @Param("examId") Long examId,
            @Param("restaurantId") Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId and a.restaurant.id = :restaurantId
              and (a.active = true or (a.active = false
                and a.deactivationReason = ru.staffly.training.model.TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN))
            order by a.id
            """)
    List<TrainingExamAssignment> findLifecycleObligationsForPublication(@Param("examId") Long examId,
                                                                        @Param("restaurantId") Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            join fetch a.user u
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = false
              and a.deactivationReason = :reason
            order by a.id
            """)
    List<TrainingExamAssignment> findInactiveByDeactivationReasonForRestore(
            @Param("examId") Long examId,
            @Param("restaurantId") Long restaurantId,
            @Param("reason") TrainingExamAssignmentDeactivationReason reason);

    @Query("""
            select a from TrainingExamAssignment a
            where a.restaurant.id = :restaurantId
              and a.active = true
              and a.exam.id in :examIds
            """)
    List<TrainingExamAssignment> findActiveByRestaurantIdAndExamIds(@Param("restaurantId") Long restaurantId,
                                                                    @Param("examIds") Collection<Long> examIds);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select a from TrainingExamAssignment a
            join fetch a.exam e
            where a.restaurant.id = :restaurantId
              and a.active = true
              and e.id in :examIds
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
            order by a.id
            """)
    List<TrainingExamAssignment> findActiveCertificationObligationsForAnalyticsUpdate(
            @Param("restaurantId") Long restaurantId,
            @Param("examIds") Collection<Long> examIds
    );

    @Query("""
            select a from TrainingExamAssignment a
            left join fetch a.assignedPosition ap
            join fetch a.user u
            join a.exam e
            where a.restaurant.id = :restaurantId
              and a.active = true
              and a.user.id in :userIds
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and e.active = true
            """)
    List<TrainingExamAssignment> findActiveByRestaurantIdAndUserIds(@Param("restaurantId") Long restaurantId,
                                                                    @Param("userIds") Collection<Long> userIds);

    @Query("""
            select a from TrainingExamAssignment a
            join fetch a.exam e
            where a.restaurant.id = :restaurantId
              and a.user.id = :userId
              and a.active = true
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and e.active = true
            order by a.assignedAt desc, a.id desc
            """)
    List<TrainingExamAssignment> findActiveCertificationAssignmentsForUser(@Param("restaurantId") Long restaurantId,
                                                                           @Param("userId") Long userId);

    @Query("""
            select a from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = true
              and a.user.id in :userIds
            """)
    List<TrainingExamAssignment> findActiveByExamIdAndRestaurantIdAndUserIds(@Param("examId") Long examId,
                                                                             @Param("restaurantId") Long restaurantId,
                                                                             @Param("userIds") Collection<Long> userIds);

    @Query("""
            select count(a) from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = true
            """)
    long countActiveObligations(@Param("examId") Long examId,
                            @Param("restaurantId") Long restaurantId);

    @Query("""
            select count(a) from TrainingExamAssignment a
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = true
              and a.status in :statuses
            """)
    long countActiveObligationsByStatusIn(@Param("examId") Long examId,
                                      @Param("restaurantId") Long restaurantId,
                                      @Param("statuses") Collection<TrainingExamAssignmentStatus> statuses);

    long countByAssignmentCycleIdAndActiveTrue(Long assignmentCycleId);

    long countByAssignmentCycleIdAndActiveTrueAndStatusIn(Long assignmentCycleId,
                                                          Collection<TrainingExamAssignmentStatus> statuses);
}
