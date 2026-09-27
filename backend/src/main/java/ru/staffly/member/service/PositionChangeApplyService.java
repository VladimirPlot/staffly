package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.dto.ApplyPositionChangeRequest;
import ru.staffly.member.dto.ApplyPositionChangeRequest.ScheduleDecision;
import ru.staffly.member.dto.ApplyPositionChangeResult;
import ru.staffly.member.dto.PositionChangeImpactPlan.Action;
import ru.staffly.member.dto.AppliedPositionChangeScheduleEffect;
import ru.staffly.member.dto.PositionChangeScheduleEffectType;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.PositionChangeAudit;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.PositionChangeAuditRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.security.SecurityService;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.inbox.service.BusinessNotificationOperationId;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class PositionChangeApplyService {
    private static final String STALE = "POSITION_CHANGE_PLAN_STALE: refresh the impact plan";

    private final RestaurantMemberRepository members;
    private final PositionRepository positions;
    private final ScheduleRepository schedules;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final SchedulePreferenceLifecycleService lifecycle;
    private final PositionChangeAuditRepository audits;
    private final MemberMapper memberMapper;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;
    private final PublishedShiftImpactClassifier shiftClassifier;
    private final CertificationAudienceSyncService certificationAudienceSync;
    private final PositionChangeNotificationService notifications;

    @Transactional
    public ApplyPositionChangeResult apply(Long restaurantId, Long memberId,
                                           ApplyPositionChangeRequest request, Long actorUserId) {
        security.assertAtLeastManager(actorUserId, restaurantId);
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(this::stale);
        if (member.getPosition() == null
                || !Objects.equals(member.getPosition().getId(), request.expectedCurrentPositionId())
                || !Objects.equals(member.getCreatedAt(), request.expectedMemberCreatedAt())) throw stale();

        Position target = positions.findForShareByIdAndRestaurantId(request.targetPositionId(), restaurantId)
                .orElseThrow(this::stale);
        if (!Objects.equals(target.getRestaurant().getId(), restaurantId) || !target.isActive()
                || !compatible(target.getLevel(), member.getRole())
                || Objects.equals(target.getId(), member.getPosition().getId())) throw stale();

        Map<Long, ScheduleDecision> decisions;
        try {
            decisions = request.schedules().stream().collect(Collectors.toMap(
                    ScheduleDecision::scheduleId, Function.identity()));
        } catch (RuntimeException ex) {
            throw new BadRequestException("Each affected schedule must have exactly one decision");
        }

        Set<Long> affected = new TreeSet<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId)
                .forEach(s -> affected.add(s.getId()));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId)
                .forEach(s -> affected.add(s.getId()));
        schedules.findByRestaurantIdAndPositionId(restaurantId, target.getId())
                .forEach(s -> affected.add(s.getId()));
        if (!affected.equals(decisions.keySet())) throw stale();

        // Global order: member mutex above, then every affected schedule in ascending id order.
        List<Schedule> locked = affected.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, new ArrayList<>(affected));
        if (locked.size() != affected.size()) throw stale();
        locked.forEach(s -> validateToken(s, decisions.get(s.getId()), memberId, target.getId()));

        Long oldPositionId = member.getPosition().getId();
        String oldPositionName = member.getPosition().getName();
        LocalDateTime localNow = LocalDateTime.ofInstant(restaurantTime.nowInstant(),
                restaurantTime.zoneFor(member.getRestaurant()));
        int cancelled = 0;
        List<String> cleanup = new ArrayList<>();
        Map<Long, EnumSet<PositionChangeScheduleEffectType>> applied = new TreeMap<>();
        Map<Long, Integer> cancelledBySchedule = new HashMap<>();

        // Remove old snapshots first. No old participation is ever transformed in place.
        for (Schedule schedule : locked) {
            ScheduleDecision decision = decisions.get(schedule.getId());
            ScheduleParticipation old = participations.findByScheduleIdAndMemberId(schedule.getId(), memberId)
                    .filter(p -> Objects.equals(p.getPositionId(), oldPositionId)).orElse(null);
            boolean hadSubmission = submissions.findByScheduleIdAndMemberId(schedule.getId(), memberId)
                    .filter(s -> Objects.equals(s.getPositionId(), oldPositionId)).isPresent();
            ScheduleRow row = oldRow(schedule, memberId, oldPositionId);
            if (old != null || hadSubmission) {
                var removal = lifecycle.removeParticipantWithLocksHeld(
                        schedule, member, actorUserId, "Смена должности");
                if (removal.participationRemoved())
                    mark(applied, schedule, PositionChangeScheduleEffectType.OLD_PARTICIPATION_REMOVED);
                if (removal.submissionRemoved())
                    mark(applied, schedule, PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED);
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
                        schedule, actorUserId, "Смена должности участника");
                if (invalidated)
                    mark(applied, schedule, PositionChangeScheduleEffectType.AUTO_BUILD_RESULT_INVALIDATED);
                cleanup.add(schedule.getId() + ":preference draft invalidated");
            }
        }

        member.setPosition(target);
        members.save(member);

        List<ApplyPositionChangeResult.ReopenedCollection> reopened = new ArrayList<>();
        for (Schedule schedule : locked) {
            ScheduleDecision decision = decisions.get(schedule.getId());
            if (decision.action() == null) {
                schedule.setUpdatedAt(restaurantTime.nowInstant());
                continue; // old-position-only impact: cleanup token, not a new-position decision
            }
            switch (decision.action()) {
                case ADD_TO_COLLECTION -> {
                    requireStatus(schedule, ScheduleStatus.COLLECTING_PREFERENCES);
                    if (decision.newDeadline() != null) {
                        requireFuture(decision.newDeadline());
                        schedule.setPreferenceDeadline(decision.newDeadline());
                    }
                    if (lifecycle.addParticipantWithLocksHeld(schedule, member, actorUserId, "Смена должности"))
                        mark(applied, schedule, PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
                }
                case CHANGE_POSITION_AND_REOPEN_COLLECTION -> {
                    requireStatus(schedule, ScheduleStatus.PREFERENCES_CLOSED);
                    var result = lifecycle.reopenWithLocksHeld(
                            schedule, member, decision.newDeadline(), actorUserId, "Смена должности");
                    if (result.participantCreated())
                        mark(applied, schedule, PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
                    mark(applied, schedule, PositionChangeScheduleEffectType.COLLECTION_REOPENED);
                    reopened.add(new ApplyPositionChangeResult.ReopenedCollection(schedule.getId(), decision.newDeadline()));
                }
                case REOPEN_AND_REBUILD_PREFERENCE_FLOW -> {
                    requireStatus(schedule, ScheduleStatus.DRAFT_FROM_PREFERENCES);
                    var result = lifecycle.reopenWithLocksHeld(
                            schedule, member, decision.newDeadline(), actorUserId, "Смена должности");
                    if (result.participantCreated())
                        mark(applied, schedule, PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);
                    mark(applied, schedule, PositionChangeScheduleEffectType.COLLECTION_REOPENED);
                    if (result.appliedResultInvalidated())
                        mark(applied, schedule, PositionChangeScheduleEffectType.AUTO_BUILD_RESULT_INVALIDATED);
                    reopened.add(new ApplyPositionChangeResult.ReopenedCollection(schedule.getId(), decision.newDeadline()));
                }
                case DO_NOT_ADD -> {
                    if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                            && !(decision.expectedStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES
                            && schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED)) throw stale();
                }
                case CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE -> requireStatus(schedule, ScheduleStatus.PREFERENCES_CLOSED);
                case INFORMATION_ONLY -> {
                    if (schedule.getStatus() != ScheduleStatus.DRAFT && schedule.getStatus() != ScheduleStatus.PUBLISHED)
                        throw stale();
                }
            }
            schedule.setUpdatedAt(restaurantTime.nowInstant());
        }
        schedules.saveAll(locked);

        String details = "affected=" + affected + "; cleanup=" + cleanup + "; decisions="
                + decisions.values().stream().sorted(Comparator.comparing(ScheduleDecision::scheduleId))
                .map(d -> d.scheduleId() + ":" + d.action() + (d.newDeadline() == null ? "" : "@" + d.newDeadline()))
                .toList() + "; reopened=" + reopened + "; cancelledFutureShifts=" + cancelled;
        audits.save(PositionChangeAudit.builder().restaurantId(restaurantId).actorUserId(actorUserId)
                .memberId(memberId).oldPositionId(oldPositionId).newPositionId(target.getId())
                .occurredAt(restaurantTime.nowInstant()).details(details).build());
        var certificationEffects = certificationAudienceSync.syncRestaurantAudience(restaurantId, member.getUser().getId());
        List<AppliedPositionChangeScheduleEffect> scheduleEffects = locked.stream()
                .filter(schedule -> applied.containsKey(schedule.getId()))
                .map(schedule -> new AppliedPositionChangeScheduleEffect(schedule.getId(), schedule.getTitle(),
                        ownerUserId(schedule), memberId, applied.get(schedule.getId()), schedule.getPreferenceDeadline(),
                        cancelledBySchedule.getOrDefault(schedule.getId(), 0)))
                .toList();
        var actor = members.findWithUserByUserIdAndRestaurantId(actorUserId, restaurantId)
                .orElseThrow(this::stale).getUser();
        notifications.submit(member, actor, BusinessNotificationOperationId.generate(), oldPositionName,
                target.getName(), scheduleEffects, certificationEffects);
        return new ApplyPositionChangeResult(memberMapper.toDto(member), List.copyOf(affected), reopened, cancelled);
    }

    private void mark(Map<Long, EnumSet<PositionChangeScheduleEffectType>> effects, Schedule schedule,
                      PositionChangeScheduleEffectType type) {
        effects.computeIfAbsent(schedule.getId(), ignored -> EnumSet.noneOf(PositionChangeScheduleEffectType.class)).add(type);
    }

    private Long ownerUserId(Schedule schedule) {
        if (schedule.getOwnerMember() != null && schedule.getOwnerMember().getUser() != null)
            return schedule.getOwnerMember().getUser().getId();
        return schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId();
    }

    private void validateToken(Schedule schedule, ScheduleDecision d, Long memberId, Long targetPositionId) {
        if (d == null || !Objects.equals(schedule.getVersion(), d.expectedVersion())
                || schedule.getStatus() != d.expectedStatus()
                || schedule.getPreferenceCollectionCycle() != d.expectedCollectionCycle()
                || !Objects.equals(schedule.getPreferenceDeadline(), d.expectedPreferenceDeadline())) throw stale();
        ScheduleParticipation p = participations.findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        SchedulePreferenceSubmission s = submissions.findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        if (!Objects.equals(p == null ? null : p.getId(), d.expectedParticipationId())
                || !Objects.equals(s == null ? null : s.getId(), d.expectedPreferenceSubmissionId())
                || !Objects.equals(s == null ? null : s.getRevision(), d.expectedPreferenceSubmissionRevision())) throw stale();
        Hibernate.initialize(schedule.getPositions());
        Hibernate.initialize(schedule.getRows());
        Hibernate.initialize(schedule.getPreferenceShiftOptionSnapshots());
        boolean targetOpportunity = schedule.getPositions().stream()
                .anyMatch(position -> Objects.equals(position.getId(), targetPositionId));
        if (targetOpportunity != (d.action() != null) || d.action() != null && !allowed(schedule.getStatus(), d.action()))
            throw stale();
    }

    private boolean allowed(ScheduleStatus status, Action action) {
        return switch (status) {
            case COLLECTING_PREFERENCES -> action == Action.ADD_TO_COLLECTION || action == Action.DO_NOT_ADD;
            case PREFERENCES_CLOSED -> action == Action.CHANGE_POSITION_AND_REOPEN_COLLECTION
                    || action == Action.CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE;
            case DRAFT_FROM_PREFERENCES -> action == Action.REOPEN_AND_REBUILD_PREFERENCE_FLOW || action == Action.DO_NOT_ADD;
            case DRAFT, PUBLISHED -> action == Action.INFORMATION_ONLY;
        };
    }

    private ScheduleRow oldRow(Schedule schedule, Long memberId, Long positionId) {
        return schedule.getRows().stream().filter(r -> Objects.equals(r.getMemberId(), memberId)
                && Objects.equals(r.getPositionId(), positionId)).findFirst().orElse(null);
    }
    private void requireStatus(Schedule s, ScheduleStatus status) { if (s.getStatus() != status) throw stale(); }
    private void requireFuture(Instant deadline) {
        if (!deadline.isAfter(restaurantTime.nowInstant())) throw new BadRequestException("preferenceDeadline must be in the future");
    }
    private ConflictException stale() { return new ConflictException(STALE, Map.of("code", "POSITION_CHANGE_PLAN_STALE")); }
    private boolean compatible(RestaurantRole level, RestaurantRole role) {
        return role == RestaurantRole.ADMIN || role == RestaurantRole.MANAGER && level != RestaurantRole.ADMIN
                || role == RestaurantRole.STAFF && level == RestaurantRole.STAFF;
    }
}
