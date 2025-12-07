package ru.staffly.checklist.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.checklist.model.ChecklistItem;

import java.util.List;

public interface ChecklistItemRepository extends JpaRepository<ChecklistItem, Long> {

    List<ChecklistItem> findByChecklistIdOrderByItemOrderAsc(Long checklistId);
}