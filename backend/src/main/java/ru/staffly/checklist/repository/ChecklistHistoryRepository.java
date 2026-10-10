package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.checklist.model.ChecklistHistory;

import java.util.List;
import java.util.Optional;
import org.springframework.data.domain.Pageable;

public interface ChecklistHistoryRepository extends JpaRepository<ChecklistHistory, Long> {
    @Query("select new ru.staffly.checklist.dto.ChecklistArchiveEntryDto(null, h.checklistName, h.positionsSnapshot, true, max(h.id)) from ChecklistHistory h where h.restaurant.id = :restaurantId and h.checklist is null and h.kind = ru.staffly.checklist.model.ChecklistKind.TRACKABLE group by h.checklistName, h.positionsSnapshot")
    List<ru.staffly.checklist.dto.ChecklistArchiveEntryDto> findLegacyArchiveCatalog(Long restaurantId);

    @Query("select h from ChecklistHistory h where h.id = :id and h.restaurant.id = :restaurantId")
    Optional<ChecklistHistory> findMetadata(Long id, Long restaurantId);

    @Query("select h from ChecklistHistory h where h.restaurant.id = :restaurantId and h.checklist is null and h.kind = ru.staffly.checklist.model.ChecklistKind.TRACKABLE and h.checklistName = :name and (h.positionsSnapshot = :positions or (h.positionsSnapshot is null and :positions is null)) order by h.resetAt desc, h.id desc")
    List<ChecklistHistory> findLegacyHistory(Long restaurantId, String name, String positions, Pageable pageable);


    @EntityGraph(attributePaths = {"checklist"})
    List<ChecklistHistory> findByChecklistIdAndRestaurantIdOrderByResetAtDescIdDesc(Long checklistId, Long restaurantId, Pageable pageable);

    @EntityGraph(attributePaths = {"checklist"})
    List<ChecklistHistory> findByRestaurantIdOrderByResetAtDescIdDesc(Long restaurantId, Pageable pageable);

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
