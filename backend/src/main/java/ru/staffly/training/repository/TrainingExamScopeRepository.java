package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.training.dto.ExamUsageDto;
import ru.staffly.training.model.TrainingExamScope;

import java.util.List;

public interface TrainingExamScopeRepository extends JpaRepository<TrainingExamScope, Long> {
    List<TrainingExamScope> findByExamId(Long examId);
    List<TrainingExamScope> findByExamIdIn(List<Long> examIds);
    boolean existsByFolderIdIn(List<Long> folderIds);
    List<TrainingExamScope> findByFolderIdIn(List<Long> folderIds);

    @Query("select distinct new ru.staffly.training.dto.ExamUsageDto(e.id, e.title) " +
            "from TrainingExamScope s join s.exam e " +
            "where s.folder.id in :folderIds and e.restaurant.id = :restaurantId")
    List<ExamUsageDto> findExamUsagesByRestaurantIdAndFolderIds(Long restaurantId, List<Long> folderIds);

    void deleteByExamId(Long examId);
}
