package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingItem;

import java.util.List;

public interface TrainingItemRepository extends JpaRepository<TrainingItem, Long> {
    List<TrainingItem> findByCategoryIdAndActiveTrueOrderBySortOrderAscNameAsc(Long categoryId);

    boolean existsByCategoryIdAndNameIgnoreCaseAndActiveTrue(Long categoryId, String name);

    List<TrainingItem> findByCategoryIdOrderByActiveDescSortOrderAscNameAsc(Long categoryId);

    List<TrainingItem> findByCategoryId(Long categoryId);
}
