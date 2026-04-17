package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamAssignment;

import java.util.Collection;
import java.util.List;
import java.util.Optional;

public interface TrainingExamAssignmentRepository extends JpaRepository<TrainingExamAssignment, Long> {
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

    Optional<TrainingExamAssignment> findByIdAndExamIdAndRestaurantIdAndActiveTrue(Long id, Long examId, Long restaurantId);

    Optional<TrainingExamAssignment> findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(Long examId, Long restaurantId, Long userId);

    Optional<TrainingExamAssignment> findTopByExamIdAndRestaurantIdAndUserIdOrderByActiveDescAssignedAtDescIdDesc(
            Long examId,
            Long restaurantId,
            Long userId
    );

    List<TrainingExamAssignment> findByExamIdAndRestaurantIdAndActiveTrue(Long examId, Long restaurantId);

    @Query("""
            select a from TrainingExamAssignment a
            join fetch a.exam e
            where a.restaurant.id = :restaurantId
              and a.user.id = :userId
              and a.active = true
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
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
            select a from TrainingExamAssignment a
            left join fetch a.user u
            where a.exam.id = :examId
              and a.restaurant.id = :restaurantId
              and a.active = true
              and a.user.id = :userId
            order by a.assignedAt desc
            """)
    List<TrainingExamAssignment> findActiveHistoryByExamAndUser(@Param("examId") Long examId,
                                                                @Param("restaurantId") Long restaurantId,
                                                                @Param("userId") Long userId);
}