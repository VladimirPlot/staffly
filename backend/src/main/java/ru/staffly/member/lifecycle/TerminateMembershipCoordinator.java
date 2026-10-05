package ru.staffly.member.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.checklist.repository.ChecklistItemRepository;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.*;
import ru.staffly.member.model.*;
import ru.staffly.member.repository.*;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffService;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.schedule.lifecycle.*;

import java.time.Instant;
import java.util.*;

@Service
@RequiredArgsConstructor
public class TerminateMembershipCoordinator {
    private static final String STALE = "EMPLOYEE_REMOVAL_PLAN_STALE: refresh the impact plan";
    private final List<TerminationLifecycleHandler> handlers;
    private final RestaurantMemberRepository members;
    private final ru.staffly.user.repository.UserRepository users;
    private final MemberRemovalPolicyService removalPolicy;
    private final MemberResponsibilityHandoffService responsibilityHandoff;
    private final ChecklistItemRepository checklistItems;
    private final EmployeeRemovalAuditRepository audits;
    private final RestaurantTimeService restaurantTime;

    @Transactional(readOnly = true)
    public EmployeeRemovalImpactPlan preview(Long restaurantId, Long memberId, Long actorUserId) {
        RestaurantMember member = members.findWithUserAndPositionByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        removalPolicy.assertCanStartRemoval(restaurantId, actorUserId, member);
        Instant now = restaurantTime.nowInstant();
        var context = new TerminationPreviewContext(restaurantId, actorUserId, member, now);
        List<TerminationModuleImpact> impacts = handlers.stream().map(h -> h.preview(context)).toList();
        ScheduleTerminationImpact schedule = require(impacts, ScheduleTerminationImpact.class);
        var position = member.getPosition() == null ? null : new EmployeeRemovalImpactPlan.Position(
                member.getPosition().getId(), member.getPosition().getName());
        return new EmployeeRemovalImpactPlan(now, new EmployeeRemovalImpactPlan.Employee(member.getId(),
                member.getUser().getFullName(), position, member.getStartedAt()), schedule.schedules());
    }

    @Transactional
    public ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
            ApplyEmployeeRemovalRequest request, Long actorUserId) {
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId).orElseThrow(this::stale);
        removalPolicy.assertCanCompleteRemoval(restaurantId, actorUserId, member);
        if (member.getUser() != null) responsibilityHandoff.assertNoBlockingResponsibilities(restaurantId, member.getUser().getId());
        if (!Objects.equals(member.getStartedAt(), request.expectedMemberCreatedAt())
                || !Objects.equals(positionId(member), request.expectedCurrentPositionId())) throw stale();
        Instant now = restaurantTime.nowInstant();
        UUID operationId = UUID.randomUUID();
        var context = new TerminationApplyContext(restaurantId, actorUserId, member, now, operationId);
        Map<LifecycleModule, TerminationModuleDecision> decisions = Map.of(
                LifecycleModule.SCHEDULE, new ScheduleTerminationDecision(request.schedules()));
        Map<LifecycleModule, TerminationModuleResult> results = new EnumMap<>(LifecycleModule.class);
        for (var handler : handlers) {
            var result = handler.applyBeforeTermination(context, requireDecision(decisions, handler.module()));
            if (result != null) results.put(handler.module(), result);
        }
        // TODO Phase 3: move this bridge to ChecklistTerminationLifecycleHandler.
        checklistItems.releaseActiveReservationsForMember(memberId);
        Long previousPositionId = positionId(member);
        var actor = users.findById(actorUserId).orElseThrow(() -> new BadRequestException("Actor user not found"));
        member.end(actor, now);
        members.save(member);
        for (var handler : handlers) {
            var result = handler.applyAfterTermination(context, requireDecision(decisions, handler.module()), results.get(handler.module()));
            if (result != null) results.put(handler.module(), result);
        }
        ScheduleTerminationResult schedule = require(results.values(), ScheduleTerminationResult.class);
        audits.save(EmployeeRemovalAudit.builder().restaurantId(restaurantId).actorUserId(actorUserId).memberId(memberId)
                .previousPositionId(previousPositionId).occurredAt(now).affectedScheduleIds(schedule.affectedScheduleIds().toString())
                .removedParticipationCount(schedule.removedParticipationCount())
                .removedSubmissionCount(schedule.removedPreferenceSubmissionCount())
                .invalidatedPreferenceDraftCount(schedule.invalidatedAppliedPreferenceDraftCount())
                .historicalPublishedRowCount(schedule.historicalPublishedRowCount())
                .cancelledFutureShiftCount(schedule.cancelledFutureShiftCount()).build());
        return new ApplyEmployeeRemovalResult(memberId, schedule.affectedScheduleIds(), schedule.cancelledFutureShiftCount(),
                schedule.historicalPublishedRowCount(), schedule.removedPreferenceSubmissionCount(),
                schedule.removedParticipationCount(), schedule.invalidatedAppliedPreferenceDraftCount());
    }
    private Long positionId(RestaurantMember m){return m.getPosition()==null?null:m.getPosition().getId();}
    private TerminationModuleDecision requireDecision(Map<LifecycleModule,TerminationModuleDecision> d,LifecycleModule m){
        return d.getOrDefault(m, new NoTerminationModuleDecision(m)); }
    private <T> T require(Collection<?> values,Class<T> type){return values.stream().filter(type::isInstance).map(type::cast).findFirst().orElseThrow();}
    private ConflictException stale(){return new ConflictException(STALE,Map.of("code","EMPLOYEE_REMOVAL_PLAN_STALE"));}
}
