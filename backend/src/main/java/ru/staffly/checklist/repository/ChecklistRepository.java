package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.checklist.model.Checklist;

import java.util.List;
import java.util.Optional;

public interface ChecklistRepository extends JpaRepository<Checklist, Long> {

    @EntityGraph(attributePaths = {"positions", "restaurant"})
    List<Checklist> findByRestaurantIdOrderByNameAsc(Long restaurantId);

    @EntityGraph(attributePaths = {"positions", "restaurant"})
    Optional<Checklist> findWithPositionsById(Long id);
}