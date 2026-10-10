package ru.staffly.task.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.TaskTransfer;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.Candidate;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.TaskResponsibility;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.task.model.Task;
import ru.staffly.task.repository.TaskRepository;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class TaskTerminationLifecycleHandler implements TerminationLifecycleHandler {
    @org.springframework.beans.factory.annotation.Autowired private ru.staffly.task.service.TaskBoardService board;
    private final TaskRepository tasks;
    private final RestaurantMemberRepository members;

    @Override public LifecycleModule module() { return LifecycleModule.TASK; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 300; }

    @Override
    public TaskTerminationImpact preview(TerminationPreviewContext context) {
        List<Task> active = tasks.findActiveResponsibilities(context.restaurantId(), context.target().getId());
        List<RestaurantMember> all = members.findActiveWithUserByRestaurantId(context.restaurantId()).stream()
                .filter(m -> !Objects.equals(m.getId(), context.target().getId()))
                .sorted(candidateOrder(context.target())).toList();
        List<Candidate> assignees = all.stream().map(this::candidate).toList();
        List<Candidate> setters = all.stream().filter(this::canManageTasks).map(this::candidate).toList();
        List<TaskResponsibility> assigned = active.stream()
                .filter(t -> t.getAssignedMember() != null && Objects.equals(t.getAssignedMember().getId(), context.target().getId()))
                .map(t -> responsibility(t, context.mode() == TerminationMode.FORCED, assignees)).toList();
        List<TaskResponsibility> owned = active.stream()
                .filter(t -> t.getSetterMember() != null && Objects.equals(t.getSetterMember().getId(), context.target().getId()))
                .map(t -> responsibility(t, true, setters)).toList();
        return new TaskTerminationImpact(assigned, owned);
    }

    @Override
    public TaskTerminationResult applyBeforeTermination(TerminationApplyContext context,
                                                         TerminationModuleDecision rawDecision) {
        if (!(rawDecision instanceof TaskTerminationDecision decision) || decision.decisions() == null) {
            throw new BadRequestException("Task termination decisions are required");
        }
        List<Task> expected = tasks.findActiveResponsibilities(context.restaurantId(), context.target().getId());
        List<Long> ids = expected.stream().map(Task::getId).distinct().sorted().toList();
        List<Task> locked = ids.isEmpty() ? List.of() : tasks.findAllForUpdate(context.restaurantId(), ids);
        if (locked.size() != ids.size()) throw stale();

        Set<Long> assignedIds = locked.stream().filter(t -> memberId(t.getAssignedMember()).equals(context.target().getId()))
                .map(Task::getId).collect(Collectors.toCollection(TreeSet::new));
        Set<Long> setterIds = locked.stream().filter(t -> memberId(t.getSetterMember()).equals(context.target().getId()))
                .map(Task::getId).collect(Collectors.toCollection(TreeSet::new));
        Map<Long, TaskTransfer> assigneeTransfers = index(decision.decisions().assignees());
        Map<Long, TaskTransfer> setterTransfers = index(decision.decisions().setters());
        if (!assignedIds.equals(assigneeTransfers.keySet())) throw stale();
        if (!setterIds.equals(setterTransfers.keySet())) throw stale();

        int reassigned = 0, orphaned = 0, setters = 0;
        List<TaskTerminationResult.Transfer> assigneeFacts = new ArrayList<>(), setterFacts = new ArrayList<>();
        List<Task> orphanedTasks = new ArrayList<>();
        for (Task task : locked) {
            if (task.getAssignedMember() != null && Objects.equals(task.getAssignedMember().getId(), context.target().getId())) {
                if (context.mode() == TerminationMode.SELF_LEAVE) {
                    TaskTransfer token = assigneeTransfers.get(task.getId());
                    if (token == null || token.expectedVersion() != task.getVersion()
                            || !Objects.equals(token.expectedMemberId(), context.target().getId())
                            || token.newMemberId() != null) throw stale();
                    task.setAssignedMember(null);
                    task.setAssignedUser(null);
                    orphanedTasks.add(task);
                    orphaned++;
                } else {
                    RestaurantMember replacement = replacement(context, task, assigneeTransfers.get(task.getId()), false);
                    task.setAssignedMember(replacement);
                    task.setAssignedUser(replacement.getUser());
                    assigneeFacts.add(new TaskTerminationResult.Transfer(task.getId(), task.getTitle(), replacement.getId()));
                    reassigned++;
                }
            }
            if (task.getSetterMember() != null && Objects.equals(task.getSetterMember().getId(), context.target().getId())) {
                RestaurantMember replacementSetter = replacement(context, task, setterTransfers.get(task.getId()), true);
                task.setSetterMember(replacementSetter);
                task.setOverdueNotifiedFor(null);
                if(board != null) board.event(task,null,"Передана ответственность: " + replacementSetter.getUser().getFullName());
                setterFacts.add(new TaskTerminationResult.Transfer(task.getId(), task.getTitle(), replacementSetter.getId()));
                setters++;
            }
        }
        tasks.saveAll(locked);
        if(board != null) board.leave(context.target(), null);
        List<TaskTerminationResult.Orphan> orphanFacts = orphanedTasks.stream().map(task ->
                new TaskTerminationResult.Orphan(task.getId(), task.getTitle(),
                        task.getSetterMember() == null ? null : task.getSetterMember().getId())).toList();
        return new TaskTerminationResult(reassigned, orphaned, setters, assigneeFacts, setterFacts, orphanFacts);
    }

    private RestaurantMember replacement(TerminationApplyContext context, Task task, TaskTransfer transfer, boolean setter) {
        if (transfer == null || transfer.expectedVersion() != task.getVersion()
                || !Objects.equals(transfer.expectedMemberId(), context.target().getId())) throw stale();
        if (transfer.newMemberId() == null) throw stale();
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(transfer.newMemberId(), context.restaurantId())
                .orElseThrow(this::stale);
        if (Objects.equals(member.getId(), context.target().getId()) || setter && !canManageTasks(member)) throw stale();
        return member;
    }
    private Map<Long, TaskTransfer> index(List<TaskTransfer> values) {
        try { return values.stream().collect(Collectors.toMap(TaskTransfer::taskId, Function.identity(), (a,b) -> { throw stale(); }, TreeMap::new)); }
        catch (NullPointerException ex) { throw new BadRequestException("Task decisions are required"); }
    }
    private Long memberId(RestaurantMember member) { return member == null ? -1L : member.getId(); }
    private boolean canManageTasks(RestaurantMember member) {
        return member.effectiveRole() == RestaurantRole.ADMIN || member.effectiveRole() == RestaurantRole.MANAGER;
    }
    private Comparator<RestaurantMember> candidateOrder(RestaurantMember target) {
        return Comparator.comparingInt((RestaurantMember candidate) -> {
            if (target.getPosition() != null && candidate.getPosition() != null
                    && Objects.equals(target.getPosition().getId(), candidate.getPosition().getId())) return 0;
            if (candidate.effectiveRole() == target.effectiveRole()) return 1;
            return roleRank(candidate.effectiveRole()) < roleRank(target.effectiveRole()) ? 2 : 3;
        }).thenComparing(RestaurantMember::getId);
    }
    private int roleRank(RestaurantRole role) {
        return switch (role) { case ADMIN -> 0; case MANAGER -> 1; case STAFF -> 2; };
    }
    private Candidate candidate(RestaurantMember m) {
        return new Candidate(m.getId(), m.getUser().getId(), m.getUser().getFullName(),
                m.getPosition() == null ? null : m.getPosition().getName());
    }
    private TaskResponsibility responsibility(Task task, boolean required, List<Candidate> candidates) {
        return new TaskResponsibility(task.getId(), task.getVersion(), task.getTitle(),
                task.getDueDate() == null ? null : task.getDueDate().toString(), required, candidates);
    }
    private ConflictException stale() {
        return new ConflictException("EMPLOYEE_REMOVAL_PLAN_STALE: refresh the impact plan",
                Map.of("code", "EMPLOYEE_REMOVAL_PLAN_STALE"));
    }
}
