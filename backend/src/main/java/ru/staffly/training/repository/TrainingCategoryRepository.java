package ru.staffly.training.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.training.model.TrainingCategory;
import ru.staffly.training.model.TrainingModule;

import java.util.List;
import java.util.Optional;

public interface TrainingCategoryRepository extends JpaRepository<TrainingCategory, Long> {

    boolean existsByRestaurantIdAndModuleAndNameIgnoreCase(Long restaurantId, TrainingModule module, String name);

    @EntityGraph(attributePaths = {"visibleForPositions", "restaurant"})
    List<TrainingCategory> findByRestaurantIdAndModuleAndActiveTrueOrderBySortOrderAscNameAsc(Long restaurantId, TrainingModule module);

    @EntityGraph(attributePaths = {"visibleForPositions", "restaurant"})
    Optional<TrainingCategory> findWithPositionsById(Long id);
}