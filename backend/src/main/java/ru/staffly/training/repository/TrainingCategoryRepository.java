package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingCategory;
import ru.staffly.training.model.TrainingModule;

import java.util.List;

public interface TrainingCategoryRepository extends JpaRepository<TrainingCategory, Long> {
    List<TrainingCategory> findByRestaurantIdAndModuleAndActiveTrueOrderBySortOrderAscNameAsc(Long restaurantId, TrainingModule module);
    boolean existsByRestaurantIdAndModuleAndNameIgnoreCase(Long restaurantId, TrainingModule module, String name);
}