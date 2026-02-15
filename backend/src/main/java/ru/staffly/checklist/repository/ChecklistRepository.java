package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.model.ChecklistKind;

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
            select distinct c
            from Checklist c
            where c.restaurant.id = :restaurantId
              and (:positionId is null or exists (
                    select 1
                    from c.positions p
                    where p.id = :positionId
              ))
              and (:kind is null or c.kind = :kind)
              and (:query is null or lower(c.name) like concat('%', lower(cast(:query as string)), '%'))
            order by c.name asc
            """)
    List<Checklist> findListDetailedByRestaurantId(Long restaurantId, Long positionId, ChecklistKind kind, String query);

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