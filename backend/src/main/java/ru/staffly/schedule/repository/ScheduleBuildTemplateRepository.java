package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.schedule.model.ScheduleBuildTemplate;

import java.util.List;
import java.util.Optional;

public interface ScheduleBuildTemplateRepository extends JpaRepository<ScheduleBuildTemplate, Long> {

    @EntityGraph(attributePaths = {
            "positionConfigs", "positionConfigs.position"
    })
    List<ScheduleBuildTemplate> findByRestaurantIdAndIsActiveTrueOrderByNameAsc(Long restaurantId);

    @EntityGraph(attributePaths = {
            "positionConfigs", "positionConfigs.position"
    })
    Optional<ScheduleBuildTemplate> findByIdAndRestaurantId(Long id, Long restaurantId);

    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);
}
