package ru.staffly.task.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.task.model.TaskComment;

import java.util.List;

public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {

    @Query("""
           select c from TaskComment c
           join fetch c.author
           where c.task.id = :taskId
           order by c.createdAt asc
           """)
    List<TaskComment> findByTaskId(Long taskId);
}