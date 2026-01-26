package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.checklist.model.Checklist;

import java.util.List;
import java.util.Optional;

public interface ChecklistRepository extends JpaRepository<Checklist, Long> {

    @EntityGraph(attributePaths = {
            "positions",
            "restaurant",
            "items",
            "items.doneBy",
            "items.doneBy.user",
            "items.reservedBy",
            "items.reservedBy.user"
    })
    @Query("""
            select c
            from Checklist c
            where c.restaurant.id = :restaurantId
            order by c.kind desc, c.name asc
            """)
    List<Checklist> findListDetailedByRestaurantId(Long restaurantId);

    @EntityGraph(attributePaths = {"positions", "restaurant"})
    Optional<Checklist> findWithPositionsById(Long id);

    @EntityGraph(attributePaths = {
            "positions",
            "restaurant",
            "items",
            "items.doneBy",
            "items.doneBy.user",
            "items.reservedBy",
            "items.reservedBy.user"
    })
    Optional<Checklist> findDetailedById(Long id);
}