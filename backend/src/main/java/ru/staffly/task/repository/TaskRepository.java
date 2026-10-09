package ru.staffly.task.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import ru.staffly.task.model.Task;
import ru.staffly.task.model.TaskStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface TaskRepository extends JpaRepository<Task, Long> {

    // Scalar lookup avoids caching a task snapshot before waiting on the lifecycle mutex.
    @Query("select t.restaurant.id from Task t where t.id = :taskId and t.deletedAt is null")
    Optional<Long> findRestaurantIdByActiveId(Long taskId);

    @Query("""
           select t from Task t
           left join fetch t.assignedMember am
           left join fetch am.user
           left join fetch t.assignedPosition
           left join fetch t.createdBy
           where t.restaurant.id = :restaurantId
             and t.deletedAt is null
             and (
               :viewAll = true
               or t.assignedToAll = true
               or t.assignedMember.id = :memberId
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
                                   Long memberId,
                                   Long positionId,
                                   boolean viewAll,
                                   TaskStatus status,
                                   boolean overdue,
                                   LocalDate today);

    @Query("""
           select t from Task t
           left join fetch t.assignedMember am
           left join fetch am.user
           left join fetch t.setterMember sm
           left join fetch sm.user
           left join fetch t.assignedPosition
           left join fetch t.createdBy
           where t.id = :taskId
             and t.deletedAt is null
           """)
    Optional<Task> findActiveById(Long taskId);

    @Query("""
           select distinct t from Task t
           left join fetch t.assignedMember am left join fetch am.user
           left join fetch t.setterMember sm left join fetch sm.user
           where t.restaurant.id = :restaurantId and t.status = ru.staffly.task.model.TaskStatus.ACTIVE
             and t.deletedAt is null and (am.id = :memberId or sm.id = :memberId)
           order by t.id
           """)
    List<Task> findActiveResponsibilities(Long restaurantId, Long memberId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select t from Task t where t.restaurant.id = :restaurantId and t.id in :ids order by t.id")
    List<Task> findAllForUpdate(Long restaurantId, List<Long> ids);
}
