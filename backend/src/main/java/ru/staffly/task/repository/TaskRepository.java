package ru.staffly.task.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.task.model.Task;
import ru.staffly.task.model.TaskStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    @Query("""
           select t from Task t
           left join fetch t.assignedUser
           left join fetch t.assignedPosition
           left join fetch t.createdBy
           where t.restaurant.id = :restaurantId
             and t.deletedAt is null
             and (
               :viewAll = true
               or t.assignedToAll = true
               or t.assignedUser.id = :userId
               or t.assignedPosition.id = :positionId
             )
             and (:status is null or t.status = :status)
             and (
               :overdue = false
               or (t.dueDate is not null and t.dueDate < :today)
             )
           order by
             case
               when t.priority = ru.staffly.task.model.TaskPriority.HIGH then 0
               when t.priority = ru.staffly.task.model.TaskPriority.MEDIUM then 1
               when t.priority = ru.staffly.task.model.TaskPriority.LOW then 2
               else 99
             end,
             case when t.dueDate is null then 1 else 0 end,
             t.dueDate
           """)
    List<Task> findActiveByFilters(Long restaurantId,
                                   Long userId,
                                   Long positionId,
                                   boolean viewAll,
                                   TaskStatus status,
                                   boolean overdue,
                                   LocalDate today);

    @Query("""
           select t from Task t
           left join fetch t.assignedUser
           left join fetch t.assignedPosition
           left join fetch t.createdBy
           where t.id = :taskId
             and t.deletedAt is null
           """)
    Optional<Task> findActiveById(Long taskId);
}