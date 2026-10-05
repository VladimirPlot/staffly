package ru.staffly.member.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.*;
import ru.staffly.member.model.*;
import ru.staffly.member.repository.*;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffService;
import ru.staffly.schedule.lifecycle.*;
import ru.staffly.task.lifecycle.*;
import ru.staffly.checklist.lifecycle.ChecklistTerminationImpact;
import ru.staffly.reminder.lifecycle.ReminderTerminationImpact;
import ru.staffly.checklist.lifecycle.ChecklistTerminationResult;
import ru.staffly.reminder.lifecycle.ReminderTerminationResult;

import java.time.Instant;
import java.util.*;
import jakarta.annotation.PostConstruct;

@Service
@RequiredArgsConstructor
public class TerminateMembershipCoordinator {
    private static final String STALE = "EMPLOYEE_REMOVAL_PLAN_STALE: refresh the impact plan";
    private final List<TerminationLifecycleHandler> handlers;
    private final RestaurantMemberRepository members;
    private final ru.staffly.user.repository.UserRepository users;
    private final MemberRemovalPolicyService removalPolicy;
    private final MemberResponsibilityHandoffService responsibilityHandoff;
    private final RestaurantLifecycleMutex lifecycleMutex;
    private final EmployeeRemovalAuditRepository audits;
    private final RestaurantTimeService restaurantTime;

    @PostConstruct
    void validateUniqueHandlers() {
        Set<LifecycleModule> modules = EnumSet.noneOf(LifecycleModule.class);
        for (var handler : handlers) {
            if (!modules.add(handler.module())) {
                throw new IllegalStateException("Duplicate termination lifecycle handler for " + handler.module());
            }
        }
    }

    @Transactional(readOnly = true)
    public EmployeeRemovalImpactPlan preview(Long restaurantId, Long memberId, Long actorUserId) {
        RestaurantMember member = members.findWithUserAndPositionByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        removalPolicy.assertCanStartRemoval(restaurantId, actorUserId, member);
        Instant now = restaurantTime.nowInstant();
        TerminationMode mode = mode(actorUserId, member);
        var context = new TerminationPreviewContext(restaurantId, actorUserId, member, mode, now);
        List<TerminationModuleImpact> impacts = handlers.stream().map(h -> h.preview(context)).toList();
        ScheduleTerminationImpact schedule = require(impacts, ScheduleTerminationImpact.class);
        TaskTerminationImpact tasks = require(impacts, TaskTerminationImpact.class);
        ChecklistTerminationImpact checklist = require(impacts, ChecklistTerminationImpact.class);
        ReminderTerminationImpact reminders = require(impacts, ReminderTerminationImpact.class);
        var position = member.getPosition() == null ? null : new EmployeeRemovalImpactPlan.Position(
                member.getPosition().getId(), member.getPosition().getName());
        return new EmployeeRemovalImpactPlan(now, mode, new EmployeeRemovalImpactPlan.Employee(member.getId(),
                member.getUser().getFullName(), position, member.getStartedAt()), schedule.schedules(),
                new EmployeeRemovalImpactPlan.TaskImpact(tasks.assignees(), tasks.setters()),
                new EmployeeRemovalImpactPlan.AutomaticImpact(checklist.activeReservations()),
                new EmployeeRemovalImpactPlan.AutomaticImpact(reminders.personalTargets()));
    }

    @Transactional
    public ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
            ApplyEmployeeRemovalRequest request, Long actorUserId) {
        // Global ordering: Restaurant lifecycle mutex -> target member -> module locks.
        lifecycleMutex.lock(restaurantId);
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId).orElseThrow(this::alreadyEnded);
        removalPolicy.assertCanCompleteRemoval(restaurantId, actorUserId, member);
        // Until Schedule/Certification expose typed atomic owner decisions, mandatory
        // resources must remain protected from becoming owned by an ended membership.
        if (member.getUser() != null) {
            responsibilityHandoff.assertNoBlockingResponsibilities(restaurantId, member.getUser().getId());
        }
        if (!Objects.equals(member.getStartedAt(), request.expectedMemberCreatedAt())
                || !Objects.equals(positionId(member), request.expectedCurrentPositionId())) throw stale();
        Instant now = restaurantTime.nowInstant();
        UUID operationId = UUID.randomUUID();
        var context = new TerminationApplyContext(restaurantId, actorUserId, member, mode(actorUserId, member), now, operationId);
        Map<LifecycleModule, TerminationModuleDecision> decisions = Map.of(
                LifecycleModule.SCHEDULE, new ScheduleTerminationDecision(request.schedules()),
                LifecycleModule.TASK, new TaskTerminationDecision(request.tasks()));
        Map<LifecycleModule, TerminationModuleResult> results = new EnumMap<>(LifecycleModule.class);
        for (var handler : handlers) {
            var result = handler.applyBeforeTermination(context, requireDecision(decisions, handler.module()));
            if (result != null) results.put(handler.module(), result);
        }
        Long previousPositionId = positionId(member);
        var actor = users.findById(actorUserId).orElseThrow(() -> new BadRequestException("Actor user not found"));
        member.end(actor, now);
        members.save(member);
        for (var handler : handlers) {
            var result = handler.applyAfterTermination(context, requireDecision(decisions, handler.module()), results.get(handler.module()));
            if (result != null) results.put(handler.module(), result);
        }
        ScheduleTerminationResult schedule = require(results.values(), ScheduleTerminationResult.class);
        TaskTerminationResult tasks = require(results.values(), TaskTerminationResult.class);
        ChecklistTerminationResult checklist = require(results.values(), ChecklistTerminationResult.class);
        ReminderTerminationResult reminders = require(results.values(), ReminderTerminationResult.class);
        audits.save(EmployeeRemovalAudit.builder().restaurantId(restaurantId).actorUserId(actorUserId).memberId(memberId)
                .previousPositionId(previousPositionId).occurredAt(now).affectedScheduleIds(schedule.affectedScheduleIds().toString())
                .removedParticipationCount(schedule.removedParticipationCount())
                .removedSubmissionCount(schedule.removedPreferenceSubmissionCount())
                .invalidatedPreferenceDraftCount(schedule.invalidatedAppliedPreferenceDraftCount())
                .historicalPublishedRowCount(schedule.historicalPublishedRowCount())
                .cancelledFutureShiftCount(schedule.cancelledFutureShiftCount()).build());
        return new ApplyEmployeeRemovalResult(memberId, schedule.affectedScheduleIds(), schedule.cancelledFutureShiftCount(),
                schedule.historicalPublishedRowCount(), schedule.removedPreferenceSubmissionCount(),
                schedule.removedParticipationCount(), schedule.invalidatedAppliedPreferenceDraftCount(),
                tasks.reassignedAssignees(), tasks.orphanedAssignees(), tasks.reassignedSetters(),
                checklist.releasedReservations(), reminders.detachedPersonalTargets());
    }
    private Long positionId(RestaurantMember m){return m.getPosition()==null?null:m.getPosition().getId();}
    private TerminationModuleDecision requireDecision(Map<LifecycleModule,TerminationModuleDecision> d,LifecycleModule m){
        return d.getOrDefault(m, new NoTerminationModuleDecision(m)); }
    private <T> T require(Collection<?> values,Class<T> type){return values.stream().filter(type::isInstance).map(type::cast).findFirst().orElseThrow();}
    private ConflictException stale(){return new ConflictException(STALE,Map.of("code","EMPLOYEE_REMOVAL_PLAN_STALE"));}
    private ConflictException alreadyEnded(){return new ConflictException("MEMBERSHIP_ALREADY_ENDED",Map.of("code","MEMBERSHIP_ALREADY_ENDED"));}
    private TerminationMode mode(Long actorUserId, RestaurantMember member) {
        return member.getUser() != null && Objects.equals(member.getUser().getId(), actorUserId)
                ? TerminationMode.SELF_LEAVE : TerminationMode.FORCED;
    }
}
