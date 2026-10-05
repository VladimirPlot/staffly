package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.checklist.model.ChecklistItem;

import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Long> {

    List<ChecklistItem> findByChecklistIdOrderByItemOrderAsc(Long checklistId);

    @Query("select count(i) from ChecklistItem i where i.reservedBy.id = :memberId")
    int countActiveReservationsForMember(@Param("memberId") Long memberId);

    /** Releases only live locks; completion data and history remain untouched. */
    @Modifying(clearAutomatically = true, flushAutomatically = true)
    @Query("""
            update ChecklistItem i
            set i.reservedBy = null, i.reservedAt = null
            where i.reservedBy.id = :memberId
            """)
    int releaseActiveReservationsForMember(@Param("memberId") Long memberId);
}
