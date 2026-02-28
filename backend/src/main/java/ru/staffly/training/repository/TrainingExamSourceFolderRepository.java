package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.training.dto.ExamUsageDto;
import ru.staffly.training.model.TrainingExamSourceFolder;

import java.util.List;

public interface TrainingExamSourceFolderRepository extends JpaRepository<TrainingExamSourceFolder, Long> {
    List<TrainingExamSourceFolder> findByExamId(Long examId);

    @Query("select distinct new ru.staffly.training.dto.ExamUsageDto(e.id, e.title) " +
            "from TrainingExamSourceFolder s join s.exam e " +
            "where s.folder.id in :folderIds and e.restaurant.id = :restaurantId")
    List<ExamUsageDto> findExamUsagesByRestaurantIdAndFolderIds(@Param("restaurantId") Long restaurantId, @Param("folderIds") List<Long> folderIds);

    void deleteByExamId(Long examId);
}
