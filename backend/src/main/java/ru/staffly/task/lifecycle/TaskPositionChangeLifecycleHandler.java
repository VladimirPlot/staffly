package ru.staffly.task.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.TaskResponsibility;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.TaskTransfer;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.task.model.Task;
import ru.staffly.task.repository.TaskRepository;
import java.util.*;
import java.util.stream.Collectors;
import static ru.staffly.member.lifecycle.PositionChangeSupport.*;

@Component
@RequiredArgsConstructor
public class TaskPositionChangeLifecycleHandler implements PositionChangeLifecycleHandler {
    private final TaskRepository tasks;
    private final RestaurantMemberRepository members;
    @Override public LifecycleModule module() { return LifecycleModule.TASK; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 300; }
    private List<Task> required(Long restaurantId, Long memberId, ru.staffly.dictionary.model.Position target) {
        if (management(target)) return List.of();
        return tasks.findActiveResponsibilities(restaurantId, memberId).stream()
                .filter(t -> t.getSetterMember() != null && Objects.equals(t.getSetterMember().getId(), memberId)).toList();
    }
    @Override public Impact preview(PositionChangePreviewContext c) {
        var candidates = members.findActiveWithUserAndPositionByRestaurantId(c.restaurantId()).stream()
                .filter(m -> !Objects.equals(m.getId(), c.member().getId()) && m.getPosition() != null && management(m.getPosition()))
                .sorted(candidateOrder(c.targetPosition())).map(PositionChangeSupport::candidate).toList();
        return new Impact(required(c.restaurantId(), c.member().getId(), c.targetPosition()).stream()
                .map(t -> new TaskResponsibility(t.getId(), t.getVersion(), t.getTitle(),
                        t.getDueDate() == null ? null : t.getDueDate().toString(), true, candidates)).toList());
    }
    @Override public Preparation applyBeforePositionChange(PositionChangeApplyContext c, PositionChangeModuleDecision raw) {
        if (!(raw instanceof Decision d)) throw stale();
        var expected = required(c.restaurantId(), c.member().getId(), c.targetPosition());
        var ids = expected.stream().map(Task::getId).sorted().toList();
        var tokens = new TreeMap<Long, TaskTransfer>();
        for (var token : d.transfers()) if (tokens.put(token.taskId(), token) != null) throw stale();
        if (!tokens.keySet().equals(new TreeSet<>(ids))) throw stale();
        var locked = ids.isEmpty() ? List.<Task>of() : tasks.findAllForUpdate(c.restaurantId(), ids);
        if (locked.size() != ids.size()) throw stale();
        var facts = new ArrayList<TaskTerminationResult.Transfer>();
        for (var task : locked) {
            var token = tokens.get(task.getId());
            if (task.getDeletedAt() != null || task.getStatus() != ru.staffly.task.model.TaskStatus.ACTIVE
                    || task.getSetterMember() == null || !Objects.equals(task.getSetterMember().getId(), c.member().getId())
                    || task.getVersion() != token.expectedVersion() || !Objects.equals(token.expectedMemberId(), c.member().getId())
                    || token.newMemberId() == null) throw stale();
            // The restaurant mutex already serializes candidate termination/position changes.
            // Do not acquire another member lock after the Schedule/Certification locks.
            var replacement = members.findWithUserAndPositionByIdAndRestaurantId(token.newMemberId(), c.restaurantId())
                    .orElseThrow(PositionChangeSupport::stale);
            if (Objects.equals(replacement.getId(), c.member().getId()) || replacement.getPosition() == null || !management(replacement.getPosition())) throw stale();
            task.setSetterMember(replacement);
            facts.add(new TaskTerminationResult.Transfer(task.getId(), task.getTitle(), replacement.getId()));
        }
        tasks.saveAll(locked);
        return new Preparation(List.copyOf(facts));
    }
    @Override public Result applyAfterPositionChange(PositionChangeApplyContext c, PositionChangeModuleDecision d, PositionChangeModulePreparation p) {
        return new Result(((Preparation)p).transfers());
    }
    public record Impact(List<TaskResponsibility> setters) implements PositionChangeModuleImpact {
        public LifecycleModule module() { return LifecycleModule.TASK; }
    }
    public record Decision(List<TaskTransfer> transfers) implements PositionChangeModuleDecision {
        public LifecycleModule module() { return LifecycleModule.TASK; }
    }
    public record Preparation(List<TaskTerminationResult.Transfer> transfers) implements PositionChangeModulePreparation {
        public LifecycleModule module() { return LifecycleModule.TASK; }
    }
    public record Result(List<TaskTerminationResult.Transfer> transfers) implements PositionChangeModuleResult {
        public LifecycleModule module() { return LifecycleModule.TASK; }
    }
}
