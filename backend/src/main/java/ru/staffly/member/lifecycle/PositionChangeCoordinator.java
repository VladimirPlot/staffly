package ru.staffly.member.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.service.BusinessNotificationOperationId;
import ru.staffly.member.dto.*;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.*;
import ru.staffly.member.repository.*;
import ru.staffly.member.service.PositionChangeNotificationService;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.lifecycle.*;
import ru.staffly.security.SecurityService;
import ru.staffly.training.lifecycle.*;

import java.time.Instant;
import java.util.*;
import jakarta.annotation.PostConstruct;

@Service
@RequiredArgsConstructor
public class PositionChangeCoordinator {
    private static final String STALE = "POSITION_CHANGE_PLAN_STALE: refresh the impact plan";
    private final List<PositionChangeLifecycleHandler> handlers;
    private final RestaurantMemberRepository members;
    private final PositionRepository positions;
    private final PositionChangeAuditRepository audits;
    private final MemberMapper memberMapper;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;
    private final PositionChangeNotificationService notifications;
    private final ru.staffly.user.repository.UserRepository users;
    private final RestaurantLifecycleMutex lifecycleMutex;

    @PostConstruct
    void validateUniqueHandlers() {
        Set<LifecycleModule> modules = EnumSet.noneOf(LifecycleModule.class);
        for (var handler : handlers) {
            if (!modules.add(handler.module())) {
                throw new IllegalStateException("Duplicate position-change lifecycle handler for " + handler.module());
            }
        }
    }

    @Transactional(readOnly = true)
    public PositionChangeImpactPlan preview(Long restaurantId, Long memberId, Long targetPositionId, Long actorUserId) {
        security.assertAtLeastManager(actorUserId, restaurantId);
        RestaurantMember member = members.findWithUserAndPositionByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (member.getPosition() == null) throw new ConflictException("Member has no current position");
        Position target = positions.findById(targetPositionId)
                .orElseThrow(() -> new NotFoundException("Position not found: " + targetPositionId));
        validateTargetAndAuthority(restaurantId, actorUserId, member, target);
        assertNotLastAdminDemotion(restaurantId, member, target);
        if (member.getPosition().getId().equals(targetPositionId)) throw new ConflictException("Target position is already assigned to member");
        Instant now = restaurantTime.nowInstant();
        var context = new PositionChangePreviewContext(restaurantId, actorUserId, member, member.getPosition(), target, now);
        List<PositionChangeModuleImpact> impacts = handlers.stream().map(h -> h.preview(context)).toList();
        SchedulePositionChangeImpact schedule = require(impacts, SchedulePositionChangeImpact.class);
        return new PositionChangeImpactPlan(now, new PositionChangeImpactPlan.Employee(member.getId(),
                member.getUser().getFullName(), new PositionChangeImpactPlan.Position(member.getPosition().getId(), member.getPosition().getName()),
                new PositionChangeImpactPlan.Position(target.getId(), target.getName()), member.getStartedAt()),
                schedule.oldPositionImpacts(), schedule.newPositionOpportunities());
    }

    @Transactional
    public ApplyPositionChangeResult apply(Long restaurantId, Long memberId,
            ApplyPositionChangeRequest request, Long actorUserId) {
        lifecycleMutex.lock(restaurantId);
        // Authority must be read after waiting for the restaurant mutex.
        security.assertAtLeastManager(actorUserId, restaurantId);
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId).orElseThrow(this::stale);
        if (member.getPosition() == null || !Objects.equals(member.getPosition().getId(), request.expectedCurrentPositionId())
                || !Objects.equals(member.getStartedAt(), request.expectedMemberCreatedAt())) throw stale();
        Position target = positions.findForShareByIdAndRestaurantId(request.targetPositionId(), restaurantId).orElseThrow(this::stale);
        if (!Objects.equals(target.getRestaurant().getId(), restaurantId) || !target.isActive()
                || Objects.equals(target.getId(), member.getPosition().getId())) throw stale();
        assertActorAuthority(restaurantId, actorUserId, member, target);
        assertNotLastAdminDemotion(restaurantId, member, target);
        Position oldPosition = member.getPosition();
        String oldPositionName = oldPosition.getName();
        RestaurantRole oldPositionLevel = member.effectiveRole();
        Instant now = restaurantTime.nowInstant();
        UUID operationId = BusinessNotificationOperationId.generate();
        var context = new PositionChangeApplyContext(restaurantId, actorUserId, member, oldPosition, target, now, operationId);
        Map<LifecycleModule, PositionChangeModuleDecision> decisions = Map.of(
                LifecycleModule.SCHEDULE, new SchedulePositionChangeDecision(request.schedules()));
        Map<LifecycleModule, PositionChangeModulePreparation> preparations = new EnumMap<>(LifecycleModule.class);
        for (var handler : handlers) {
            var preparation = handler.applyBeforePositionChange(context, requireDecision(decisions, handler.module()));
            if (preparation != null) preparations.put(handler.module(), preparation);
        }
        member.setPosition(target);
        members.save(member);
        Map<LifecycleModule, PositionChangeModuleResult> results = new EnumMap<>(LifecycleModule.class);
        for (var handler : handlers) {
            var result = handler.applyAfterPositionChange(context, requireDecision(decisions, handler.module()), preparations.get(handler.module()));
            if (result != null) results.put(handler.module(), result);
        }
        SchedulePositionChangeResult schedule = require(results.values(), SchedulePositionChangeResult.class);
        CertificationPositionChangeResult certification = require(results.values(), CertificationPositionChangeResult.class);
        String details = "affected=" + schedule.affectedScheduleIds() + "; cleanup=" + schedule.cleanup()
                + "; decisions=" + schedule.decisions().stream().sorted(Comparator.comparing(ApplyPositionChangeRequest.ScheduleDecision::scheduleId))
                .map(d -> d.scheduleId() + ":" + d.action() + (d.newDeadline() == null ? "" : "@" + d.newDeadline())).toList()
                + "; reopened=" + schedule.reopenedCollections() + "; cancelledFutureShifts=" + schedule.cancelledFutureShiftCount();
        audits.save(PositionChangeAudit.builder().restaurantId(restaurantId).actorUserId(actorUserId).memberId(memberId)
                .oldPositionId(oldPosition.getId()).newPositionId(target.getId()).oldPositionName(oldPositionName)
                .newPositionName(target.getName()).oldPositionLevel(oldPositionLevel).newPositionLevel(target.getLevel())
                .occurredAt(now).details(details).build());
        var actor = users.findById(actorUserId).orElseThrow(this::stale);
        notifications.submit(member, actor, operationId, oldPositionName, target.getName(), schedule.effects(), certification.effects());
        return new ApplyPositionChangeResult(memberMapper.toDto(member), schedule.affectedScheduleIds(),
                schedule.reopenedCollections(), schedule.cancelledFutureShiftCount());
    }

    private void validateTargetAndAuthority(Long restaurantId,Long actorUserId,RestaurantMember member,Position target){
        if(!target.getRestaurant().getId().equals(restaurantId)||!target.isActive())throw new BadRequestException("Position is not in this restaurant or inactive");
        assertActorAuthority(restaurantId, actorUserId, member, target);
    }
    private void assertActorAuthority(Long restaurantId,Long actorUserId,RestaurantMember member,Position target){
        if(!security.isAdmin(actorUserId,restaurantId)&&(member.effectiveRole()!=RestaurantRole.STAFF||target.getLevel()!=RestaurantRole.STAFF))
            throw new ru.staffly.common.exception.ForbiddenException("Managers can move only STAFF employees to STAFF positions");
    }
    private void assertNotLastAdminDemotion(Long restaurantId,RestaurantMember member,Position target){
        if(member.effectiveRole()==RestaurantRole.ADMIN&&target.getLevel()!=RestaurantRole.ADMIN
                &&members.countActiveByRestaurantIdAndPositionLevel(restaurantId,RestaurantRole.ADMIN)<=1)
            throw new ConflictException("Нельзя перевести последнего ADMIN на должность с более низким уровнем доступа");
    }
    private PositionChangeModuleDecision requireDecision(Map<LifecycleModule,PositionChangeModuleDecision>d,LifecycleModule m){return d.getOrDefault(m,new NoPositionChangeModuleDecision(m));}
    private <T>T require(Collection<?> values,Class<T> type){return values.stream().filter(type::isInstance).map(type::cast).findFirst().orElseThrow();}
    private ConflictException stale(){return new ConflictException(STALE,Map.of("code","POSITION_CHANGE_PLAN_STALE"));}
}
