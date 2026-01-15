package ru.staffly.task.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.task.model.Task;

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
           """)
    List<Task> findActiveByRestaurantId(Long restaurantId);

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