package ru.staffly.task.repository;

import org.springframework.data.domain.Page;
import org.springframework.data.domain.Pageable;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.task.model.TaskComment;

public interface TaskCommentRepository extends JpaRepository<TaskComment, Long> {

    @EntityGraph(attributePaths = "author")
    Page<TaskComment> findByTaskId(Long taskId, Pageable pageable);
}