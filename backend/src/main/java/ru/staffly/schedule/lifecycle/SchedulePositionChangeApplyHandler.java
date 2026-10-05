package ru.staffly.schedule.lifecycle;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.*;
import ru.staffly.member.dto.ApplyPositionChangeRequest.ScheduleDecision;
import ru.staffly.member.dto.PositionChangeImpactPlan.Action;
import ru.staffly.member.lifecycle.PositionChangeApplyContext;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.service.PublishedShiftImpactClassifier;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;

import java.time.*;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class SchedulePositionChangeApplyHandler {
    private static final String STALE = "POSITION_CHANGE_PLAN_STALE: refresh the impact plan";
    private final ScheduleRepository schedules;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final SchedulePreferenceLifecycleService lifecycle;
    private final RestaurantTimeService restaurantTime;
    private final PublishedShiftImpactClassifier shiftClassifier;

    public SchedulePositionChangePreparation applyBefore(PositionChangeApplyContext context,
                                                          SchedulePositionChangeDecision moduleDecision) {
        RestaurantMember member = context.member();
        Long restaurantId = context.restaurantId(), memberId = member.getId();
        Long oldPositionId = context.currentPosition().getId(), targetPositionId = context.targetPosition().getId();
        Map<Long, ScheduleDecision> decisions;
        try {
            decisions = moduleDecision.decisions().stream().collect(Collectors.toMap(ScheduleDecision::scheduleId, Function.identity()));
        } catch (RuntimeException ex) { throw new BadRequestException("Each affected schedule must have exactly one decision"); }
        Set<Long> affected = new TreeSet<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId).forEach(s -> affected.add(s.getId()));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId).forEach(s -> affected.add(s.getId()));
        schedules.findByRestaurantIdAndPositionId(restaurantId, targetPositionId).forEach(s -> affected.add(s.getId()));
        if (!affected.equals(decisions.keySet())) throw stale();
        // Coordinator owns the member lock; every schedule is then locked in ascending id order.
        List<Schedule> locked = affected.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, new ArrayList<>(affected));
        if (locked.size() != affected.size()) throw stale();
        locked.forEach(s -> validateToken(s, decisions.get(s.getId()), memberId, targetPositionId));

        LocalDateTime localNow = LocalDateTime.ofInstant(context.now(), restaurantTime.zoneFor(member.getRestaurant()));
        int cancelled = 0;
        List<String> cleanup = new ArrayList<>();
        Map<Long, EnumSet<PositionChangeScheduleEffectType>> applied = new TreeMap<>();
        Map<Long, Integer> cancelledBySchedule = new HashMap<>();
        for (Schedule schedule : locked) {
            ScheduleDecision decision = decisions.get(schedule.getId());
            ScheduleParticipation old = participations.findByScheduleIdAndMemberId(schedule.getId(), memberId)
                    .filter(p -> Objects.equals(p.getPositionId(), oldPositionId)).orElse(null);
            boolean hadSubmission = submissions.findByScheduleIdAndMemberId(schedule.getId(), memberId)
                    .filter(s -> Objects.equals(s.getPositionId(), oldPositionId)).isPresent();
            ScheduleRow row = oldRow(schedule, memberId, oldPositionId);
            if (old != null || hadSubmission) {
                var removal = lifecycle.removeParticipantWithLocksHeld(schedule, member, context.actorUserId(), "Смена должности");
                if (removal.participationRemoved()) mark(applied, schedule, PositionChangeScheduleEffectType.OLD_PARTICIPATION_REMOVED);
                if (removal.submissionRemoved()) mark(applied, schedule, PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED);
                cleanup.add(schedule.getId() + ":participation/preferences removed");
            }
            if (schedule.getStatus() == ScheduleStatus.DRAFT && row != null) {
                schedule.getRows().remove(row);
                mark(applied, schedule, PositionChangeScheduleEffectType.DRAFT_EMPLOYEE_REMOVED);
                cleanup.add(schedule.getId() + ":draft row removed");
            } else if (schedule.getStatus() == ScheduleStatus.PUBLISHED && row != null) {
                Hibernate.initialize(row.getCells());
                int count = shiftClassifier.cancelFuture(row.getCells(), localNow);
                cancelled += count;
                if (count > 0) {
                    mark(applied, schedule, PositionChangeScheduleEffectType.PUBLISHED_FUTURE_SHIFTS_CANCELLED);
                    cancelledBySchedule.put(schedule.getId(), count);
                }
                row.setHistorical(true);
                cleanup.add(schedule.getId() + ":published row historical; future shifts cancelled=" + count);
            } else if (schedule.getStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES
                    && decision.action() != Action.REOPEN_AND_REBUILD_PREFERENCE_FLOW) {
                boolean invalidated = lifecycle.invalidateAppliedPreferenceDraftWithLocksHeld(
                        schedule, context.actorUserId(), "Смена должности участника");
                if (invalidated) mark(applied, schedule, PositionChangeScheduleEffectType.AUTO_BUILD_RESULT_INVALIDATED);
                cleanup.add(schedule.getId() + ":preference draft invalidated");
            }
        }
        return new SchedulePositionChangePreparation(locked, affected, cleanup, applied, cancelledBySchedule, cancelled);
    }

    public SchedulePositionChangeResult applyAfter(PositionChangeApplyContext context,
            SchedulePositionChangeDecision moduleDecision, SchedulePositionChangePreparation preparation) {
        Map<Long, ScheduleDecision> decisions = moduleDecision.decisions().stream()
                .collect(Collectors.toMap(ScheduleDecision::scheduleId, Function.identity()));
        RestaurantMember member = context.member();
        List<ApplyPositionChangeResult.ReopenedCollection> reopened = new ArrayList<>();
        for (Schedule schedule : preparation.lockedSchedules()) {
            ScheduleDecision decision = decisions.get(schedule.getId());
            if (decision.action() == null) { schedule.setUpdatedAt(context.now()); continue; }
            switch (decision.action()) {
                case ADD_TO_COLLECTION -> {
                    requireStatus(schedule, ScheduleStatus.COLLECTING_PREFERENCES);
                    if (decision.newDeadline() != null) { requireFuture(decision.newDeadline(), context.now()); schedule.setPreferenceDeadline(decision.newDeadline()); }
                    if (lifecycle.addParticipantWithLocksHeld(schedule, member, context.actorUserId(), "Смена должности"))
                        mark(preparation.appliedEffects(), schedule, PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
                }
                case CHANGE_POSITION_AND_REOPEN_COLLECTION -> {
                    requireStatus(schedule, ScheduleStatus.PREFERENCES_CLOSED);
                    var result = lifecycle.reopenWithLocksHeld(schedule, member, decision.newDeadline(), context.actorUserId(), "Смена должности");
                    if (result.participantCreated()) mark(preparation.appliedEffects(), schedule, PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
                    mark(preparation.appliedEffects(), schedule, PositionChangeScheduleEffectType.COLLECTION_REOPENED);
                    reopened.add(new ApplyPositionChangeResult.ReopenedCollection(schedule.getId(), decision.newDeadline()));
                }
                case REOPEN_AND_REBUILD_PREFERENCE_FLOW -> {
                    requireStatus(schedule, ScheduleStatus.DRAFT_FROM_PREFERENCES);
                    var result = lifecycle.reopenWithLocksHeld(schedule, member, decision.newDeadline(), context.actorUserId(), "Смена должности");
                    if (result.participantCreated()) mark(preparation.appliedEffects(), schedule, PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
                    mark(preparation.appliedEffects(), schedule, PositionChangeScheduleEffectType.COLLECTION_REOPENED);
                    if (result.appliedResultInvalidated()) mark(preparation.appliedEffects(), schedule, PositionChangeScheduleEffectType.AUTO_BUILD_RESULT_INVALIDATED);
                    reopened.add(new ApplyPositionChangeResult.ReopenedCollection(schedule.getId(), decision.newDeadline()));
                }
                case DO_NOT_ADD -> {
                    if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                            && !(decision.expectedStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES
                            && schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED)) throw stale();
                }
                case CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE -> requireStatus(schedule, ScheduleStatus.PREFERENCES_CLOSED);
                case INFORMATION_ONLY -> { if (schedule.getStatus() != ScheduleStatus.DRAFT && schedule.getStatus() != ScheduleStatus.PUBLISHED) throw stale(); }
            }
            schedule.setUpdatedAt(context.now());
        }
        schedules.saveAll(preparation.lockedSchedules());
        List<AppliedPositionChangeScheduleEffect> effects = preparation.lockedSchedules().stream()
                .filter(s -> preparation.appliedEffects().containsKey(s.getId()))
                .map(s -> new AppliedPositionChangeScheduleEffect(s.getId(), s.getTitle(), ownerUserId(s), member.getId(),
                        preparation.appliedEffects().get(s.getId()), s.getPreferenceDeadline(),
                        preparation.cancelledBySchedule().getOrDefault(s.getId(), 0))).toList();
        return new SchedulePositionChangeResult(List.copyOf(preparation.affectedScheduleIds()), reopened,
                preparation.cancelledFutureShiftCount(), preparation.cleanup(), effects, moduleDecision.decisions());
    }

    private void mark(Map<Long, EnumSet<PositionChangeScheduleEffectType>> effects, Schedule s, PositionChangeScheduleEffectType type) {
        effects.computeIfAbsent(s.getId(), ignored -> EnumSet.noneOf(PositionChangeScheduleEffectType.class)).add(type);
    }
    private Long ownerUserId(Schedule s) { return s.getOwnerMember()!=null && s.getOwnerMember().getUser()!=null ? s.getOwnerMember().getUser().getId() : s.getOwnerUser()==null?null:s.getOwnerUser().getId(); }
    private void validateToken(Schedule s, ScheduleDecision d, Long memberId, Long targetPositionId) {
        if (d == null || !Objects.equals(s.getVersion(), d.expectedVersion()) || s.getStatus()!=d.expectedStatus()
                || s.getPreferenceCollectionCycle()!=d.expectedCollectionCycle() || !Objects.equals(s.getPreferenceDeadline(), d.expectedPreferenceDeadline())) throw stale();
        var p=participations.findByScheduleIdAndMemberId(s.getId(),memberId).orElse(null); var sub=submissions.findByScheduleIdAndMemberId(s.getId(),memberId).orElse(null);
        if (!Objects.equals(p==null?null:p.getId(),d.expectedParticipationId()) || !Objects.equals(sub==null?null:sub.getId(),d.expectedPreferenceSubmissionId())
                || !Objects.equals(sub==null?null:sub.getRevision(),d.expectedPreferenceSubmissionRevision())) throw stale();
        Hibernate.initialize(s.getPositions()); Hibernate.initialize(s.getRows()); Hibernate.initialize(s.getPreferenceShiftOptionSnapshots());
        boolean opportunity=s.getPositions().stream().anyMatch(pos->Objects.equals(pos.getId(),targetPositionId));
        if (opportunity!=(d.action()!=null) || d.action()!=null && !allowed(s.getStatus(),d.action())) throw stale();
    }
    private boolean allowed(ScheduleStatus s, Action a) { return switch(s) {
        case COLLECTING_PREFERENCES -> a==Action.ADD_TO_COLLECTION||a==Action.DO_NOT_ADD;
        case PREFERENCES_CLOSED -> a==Action.CHANGE_POSITION_AND_REOPEN_COLLECTION||a==Action.CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE;
        case DRAFT_FROM_PREFERENCES -> a==Action.REOPEN_AND_REBUILD_PREFERENCE_FLOW||a==Action.DO_NOT_ADD;
        case DRAFT,PUBLISHED -> a==Action.INFORMATION_ONLY; }; }
    private ScheduleRow oldRow(Schedule s,Long memberId,Long positionId){return s.getRows().stream().filter(r->Objects.equals(r.getMemberId(),memberId)&&Objects.equals(r.getPositionId(),positionId)).findFirst().orElse(null);}
    private void requireStatus(Schedule s,ScheduleStatus status){if(s.getStatus()!=status)throw stale();}
    private void requireFuture(Instant deadline,Instant now){if(!deadline.isAfter(now))throw new BadRequestException("preferenceDeadline must be in the future");}
    private ConflictException stale(){return new ConflictException(STALE,Map.of("code","POSITION_CHANGE_PLAN_STALE"));}
}
