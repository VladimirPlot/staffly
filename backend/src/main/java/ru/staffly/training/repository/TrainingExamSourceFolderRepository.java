package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.dto.ExamUsageDto;
import ru.staffly.training.model.TrainingExamSourceFolder;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.model.TrainingExamSourcePickMode;
import ru.staffly.training.repository.projection.TrainingExamUsageProjection;

import java.util.List;

public interface TrainingExamSourceFolderRepository extends JpaRepository<TrainingExamSourceFolder, Long> {
    List<TrainingExamSourceFolder> findByExamId(Long examId);

    @Query("select distinct new ru.staffly.training.dto.ExamUsageDto(e.id, e.title) " +
            "from TrainingExamSourceFolder s join s.exam e " +
            "where s.folder.id in :folderIds and e.restaurant.id = :restaurantId")
    List<ExamUsageDto> findExamUsagesByRestaurantIdAndFolderIds(@Param("restaurantId") Long restaurantId, @Param("folderIds") List<Long> folderIds);

    @Query("select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId " +
            "from TrainingExamSourceFolder s join s.exam e " +
            "where s.folder.id in :folderIds and e.restaurant.id = :restaurantId and e.active = true")
    List<TrainingExamUsageProjection> findActiveExamUsagesByRestaurantIdAndFolderIds(
            @Param("restaurantId") Long restaurantId,
            @Param("folderIds") List<Long> folderIds);

    @Query("""
            select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId
            from TrainingExamSourceFolder s
            join s.exam e
            where s.folder.id = :folderId
              and s.pickMode = :pickMode
              and e.restaurant.id = :restaurantId
              and e.mode = :examMode
              and e.active = true
            """)
    List<TrainingExamUsageProjection> findActiveExamUsagesByFolderAndPickModeAndExamMode(
            @Param("restaurantId") Long restaurantId,
            @Param("folderId") Long folderId,
            @Param("pickMode") TrainingExamSourcePickMode pickMode,
            @Param("examMode") TrainingExamMode examMode);

    @Query("""
            select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId
            from TrainingExamSourceFolder s
            join s.exam e, TrainingQuestion q
            where q.id = :questionId
              and q.restaurant.id = :restaurantId
              and s.folder.id = q.folder.id
              and e.restaurant.id = :restaurantId
            """)
    List<TrainingExamUsageProjection> findExamUsagesByRestaurantIdAndQuestionViaFolder(@Param("restaurantId") Long restaurantId,
                                                                                       @Param("questionId") Long questionId);

    @Query("""
            select distinct e.id as id, e.title as title, e.mode as mode, e.folder.id as knowledgeFolderId
            from TrainingExamSourceFolder s
            join s.exam e, TrainingQuestion q
            where q.id = :questionId
              and q.restaurant.id = :restaurantId
              and s.folder.id = q.folder.id
              and e.restaurant.id = :restaurantId
              and e.active = true
            """)
    List<TrainingExamUsageProjection> findActiveExamUsagesByRestaurantIdAndQuestionViaFolder(
            @Param("restaurantId") Long restaurantId,
            @Param("questionId") Long questionId);

    void deleteByExamId(Long examId);
}
