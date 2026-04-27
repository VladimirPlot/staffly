package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.model.TrainingExamMode;

import java.util.List;
import java.util.Optional;

public interface TrainingExamRepository extends JpaRepository<TrainingExam, Long> {
    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.restaurant.id = :restaurantId
            order by e.createdAt desc
            """)
    List<TrainingExam> findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(@Param("restaurantId") Long restaurantId);

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.restaurant.id = :restaurantId
              and e.active = true
            order by e.createdAt desc
            """)
    List<TrainingExam> findByRestaurantIdAndActiveTrueWithVisibilityOrderByCreatedAtDesc(@Param("restaurantId") Long restaurantId);

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.restaurant.id = :restaurantId
              and e.active = true
              and (:mode is null or e.mode = :mode)
              and (vp.id is null or vp.id = :positionId)
            order by e.createdAt desc
            """)
    List<TrainingExam> listVisibleForStaff(
            @Param("restaurantId") Long restaurantId,
            @Param("positionId") Long positionId,
            @Param("mode") TrainingExamMode mode
    );

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.id = :id and e.restaurant.id = :restaurantId
            """)
    Optional<TrainingExam> findByIdAndRestaurantIdWithVisibility(@Param("id") Long id, @Param("restaurantId") Long restaurantId);

    Optional<TrainingExam> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            where e.restaurant.id = :restaurantId
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and e.active = true
            order by e.createdAt desc
            """)
    List<TrainingExam> findActiveCertificationByRestaurantIdWithVisibility(@Param("restaurantId") Long restaurantId);

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.restaurant.id = :restaurantId
              and e.mode = ru.staffly.training.model.TrainingExamMode.PRACTICE
              and e.knowledgeFolder.id = :folderId
              and (:includeInactive = true or e.active = true)
              and (:positionId is null or vp.id is null or vp.id = :positionId)
            order by e.createdAt desc
            """)
    List<TrainingExam> listPracticeByKnowledgeFolder(@Param("restaurantId") Long restaurantId,
                                                     @Param("folderId") Long folderId,
                                                     @Param("includeInactive") boolean includeInactive,
                                                     @Param("positionId") Long positionId);

    @Query("""
            select distinct new ru.staffly.training.dto.ExamUsageDto(e.id, e.title)
            from TrainingExam e
            where e.restaurant.id = :restaurantId
              and e.mode = ru.staffly.training.model.TrainingExamMode.PRACTICE
              and e.knowledgeFolder.id in :folderIds
            """)
    List<ru.staffly.training.dto.ExamUsageDto> findPracticeExamUsagesByKnowledgeFolderIds(@Param("restaurantId") Long restaurantId,
                                                                                          @Param("folderIds") List<Long> folderIds);

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.restaurant.id = :restaurantId
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and e.active = true
              and e.owner.id = :ownerUserId
            order by e.createdAt desc
            """)
    List<TrainingExam> findActiveCertificationByRestaurantIdAndOwnerUserIdWithVisibility(@Param("restaurantId") Long restaurantId,
                                                                                         @Param("ownerUserId") Long ownerUserId);

    @Query("""
            select distinct e from TrainingExam e
            left join fetch e.visibilityPositions vp
            left join fetch e.createdBy cb
            left join fetch e.owner ow
            where e.restaurant.id = :restaurantId
              and e.mode = ru.staffly.training.model.TrainingExamMode.CERTIFICATION
              and e.active = true
              and e.id in :examIds
            """)
    List<TrainingExam> findActiveCertificationByRestaurantIdAndIdInWithVisibility(@Param("restaurantId") Long restaurantId,
                                                                                  @Param("examIds") List<Long> examIds);

}
