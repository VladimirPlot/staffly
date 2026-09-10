package ru.staffly.schedule.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.ScheduleBuildTemplate;

import java.util.List;
import java.util.Optional;

public interface ScheduleBuildTemplateRepository extends JpaRepository<ScheduleBuildTemplate, Long> {

    @EntityGraph(attributePaths = {
            "positionConfigs", "positionConfigs.positions"
    })
    List<ScheduleBuildTemplate> findByRestaurantIdAndIsActiveTrueOrderByNameAsc(Long restaurantId);

    @EntityGraph(attributePaths = {
            "positionConfigs", "positionConfigs.positions"
    })
    Optional<ScheduleBuildTemplate> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from ScheduleBuildTemplate t where t.id = :id and t.restaurant.id = :restaurantId")
    Optional<ScheduleBuildTemplate> findForUpdateByIdAndRestaurantId(@Param("id") Long id,
                                                                      @Param("restaurantId") Long restaurantId);

    @EntityGraph(attributePaths = {
            "positionConfigs", "positionConfigs.positions"
    })
    Optional<ScheduleBuildTemplate> findDetailedByIdAndRestaurantIdAndIsActiveTrue(Long id, Long restaurantId);

    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);
}
