package ru.staffly.task.service;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Component;
import org.springframework.scheduling.annotation.Scheduled;
import ru.staffly.task.repository.TaskRepository;
@Component @RequiredArgsConstructor @Slf4j
public class TaskOverdueJob {
 private final TaskRepository tasks;private final TaskBoardService board;
 @Scheduled(fixedDelayString="${app.tasks.overdue-interval-ms:60000}")
 public void dispatch(){for(Long id:tasks.findOpenWithDeadline())try{board.notifyOverdue(id);}catch(Exception ex){log.warn("Failed to check overdue task {}",id,ex);}}
}
