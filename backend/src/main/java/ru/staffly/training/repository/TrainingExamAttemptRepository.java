package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExamAttempt;

import java.util.List;
import java.util.Optional;

public interface TrainingExamAttemptRepository extends JpaRepository<TrainingExamAttempt, Long> {
    Optional<TrainingExamAttempt> findByIdAndRestaurantId(Long id, Long restaurantId);

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

    List<TrainingExamAttempt> findByExamIdAndRestaurantIdAndUserIdOrderByStartedAtDesc(Long examId, Long restaurantId, Long userId);
}
