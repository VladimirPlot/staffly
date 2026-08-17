package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.checklist.model.ChecklistHistory;

import java.util.List;
import java.util.Optional;

public interface ChecklistHistoryRepository extends JpaRepository<ChecklistHistory, Long> {

    @EntityGraph(attributePaths = {"checklist"})
    List<ChecklistHistory> findTop50ByChecklistIdAndRestaurantIdOrderByResetAtDesc(Long checklistId, Long restaurantId);

    @EntityGraph(attributePaths = {
            "checklist",
            "items",
            "items.sourceItem",
            "items.doneBy",
            "items.doneBy.user",
            "items.reservedBy",
            "items.reservedBy.user"
    })
    Optional<ChecklistHistory> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Query("""
            select count(h) > 0
            from ChecklistHistory h
            join h.items i
            where i.examplePhotoUrl = :url
            """)
    boolean existsByExamplePhotoUrl(String url);

    @Query("""
            select count(h) > 0
            from ChecklistHistory h
            join h.items i
            where i.completionPhotoUrl = :url
            """)
    boolean existsByCompletionPhotoUrl(String url);
}
