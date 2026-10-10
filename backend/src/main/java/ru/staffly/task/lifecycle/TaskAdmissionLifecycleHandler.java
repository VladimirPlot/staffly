package ru.staffly.task.lifecycle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import org.springframework.core.Ordered;
import ru.staffly.member.lifecycle.*;
import ru.staffly.task.service.TaskBoardService;
import ru.staffly.task.repository.TaskRepository;
import java.util.List;
@Component @RequiredArgsConstructor
public class TaskAdmissionLifecycleHandler implements AdmissionLifecycleHandler {
 private final TaskBoardService board;
 private final TaskRepository tasks;
 public LifecycleModule module(){return LifecycleModule.TASK;}
 public int getOrder(){return Ordered.HIGHEST_PRECEDENCE+300;}
 public PreparedAdmission prepare(AdmissionApplyContext c){
  var decisions=c.invitation().getTaskDecisions();
  for(var d:decisions) {
   var t=tasks.findActiveById(d.taskId()).orElseThrow(()->new AdmissionPlanInvalidException("TASK_UNAVAILABLE"));
   if(!t.getRestaurant().getId().equals(c.invitation().getRestaurant().getId())||t.getDefinitionVersion()!=d.expectedVersion()) throw new AdmissionPlanInvalidException("TASK_CHANGED");
  }
  return member->{board.changePosition(member,c.position().getId(),decisions,null);return new AdmissionModuleResult(c.operationId(),List.of(),List.of());};
 }
}
