package ru.staffly.schedule.lifecycle;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.PositionChangeImpactPlan;
import ru.staffly.member.dto.PositionChangeImpactPlan.*;
import ru.staffly.member.dto.PublishedShiftImpact;
import ru.staffly.member.service.PublishedShiftImpactClassifier;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.lifecycle.PositionChangePreviewContext;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.time.Duration;
import java.time.Instant;
import java.time.LocalDateTime;
import java.util.*;

@Service
@RequiredArgsConstructor
public class SchedulePositionChangePreviewHandler {
    private final ScheduleRepository schedules;
    private final RestaurantTimeService restaurantTime;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final PublishedShiftImpactClassifier shiftClassifier;

    @Transactional(Transactional.TxType.SUPPORTS)
    public SchedulePositionChangeImpact preview(PositionChangePreviewContext context) {
        RestaurantMember member = context.member();
        Long restaurantId = context.restaurantId();
        Long memberId = member.getId();
        Long oldPositionId = context.currentPosition().getId();
        Long targetPositionId = context.targetPosition().getId();
        LocalDateTime localNow = LocalDateTime.ofInstant(context.now(), restaurantTime.zoneFor(member.getRestaurant()));
        Map<Long, Schedule> oldCandidates = new TreeMap<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId)
                .forEach(schedule -> oldCandidates.put(schedule.getId(), schedule));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId)
                .forEach(schedule -> oldCandidates.put(schedule.getId(), schedule));
        List<OldPositionImpact> oldImpacts = oldCandidates.values().stream()
                .map(schedule -> oldImpact(schedule, memberId, oldPositionId, localNow))
                .filter(Objects::nonNull).toList();
        List<NewPositionOpportunity> opportunities = schedules
                .findByRestaurantIdAndPositionId(restaurantId, targetPositionId).stream()
                .sorted(Comparator.comparing(Schedule::getId))
                .map(schedule -> newOpportunity(schedule, targetPositionId, context.now())).toList();
        return new SchedulePositionChangeImpact(oldImpacts, opportunities);
    }

    private OldPositionImpact oldImpact(Schedule schedule, Long memberId, Long oldPositionId,
                                        LocalDateTime localNow) {
        Hibernate.initialize(schedule.getRows());
        ScheduleParticipation participation = participations.findByScheduleIdAndMemberId(schedule.getId(), memberId)
                .filter(value -> oldPositionId.equals(value.getPositionId())).orElse(null);
        ScheduleRow row = schedule.getRows().stream()
                .filter(value -> memberId.equals(value.getMemberId()) && oldPositionId.equals(value.getPositionId()))
                .findFirst().orElse(null);
        if (participation == null && row == null) return null;

        SchedulePreferenceSubmission submission = submissions.findByScheduleIdAndMemberId(schedule.getId(), memberId)
                .filter(value -> oldPositionId.equals(value.getPositionId())).orElse(null);
        ScheduleStatus status = schedule.getStatus();
        boolean preferenceLifecycle = status == ScheduleStatus.COLLECTING_PREFERENCES
                || status == ScheduleStatus.PREFERENCES_CLOSED
                || status == ScheduleStatus.DRAFT_FROM_PREFERENCES;
        boolean published = status == ScheduleStatus.PUBLISHED;
        PublishedShiftImpact shiftImpact = null;
        if (published && row != null) {
            Hibernate.initialize(row.getCells());
            shiftImpact = shiftClassifier.classify(row.getCells(), localNow);
        }
        return new OldPositionImpact(schedule.getId(), schedule.getTitle(), status, schedule.getVersion(),
                schedule.getPreferenceCollectionCycle(), schedule.getPreferenceDeadline(),
                participation == null ? null : participation.getId(), participation != null,
                submission == null ? null : submission.getId(), submission == null ? null : submission.getRevision(),
                preferenceLifecycle && submission != null,
                status == ScheduleStatus.COLLECTING_PREFERENCES && participation != null,
                status == ScheduleStatus.DRAFT_FROM_PREFERENCES,
                status == ScheduleStatus.DRAFT && row != null, published && row != null, shiftImpact);
    }

    private NewPositionOpportunity newOpportunity(Schedule schedule, Long targetPositionId, Instant now) {
        Hibernate.initialize(schedule.getPreferenceShiftOptionSnapshots());
        boolean shiftOptionsRequired = schedule.getPreferenceCollectionMode() == PreferenceCollectionMode.SHIFT_OPTIONS;
        List<Long> applicableSnapshotIds = schedule.getPreferenceShiftOptionSnapshots().stream()
                .filter(snapshot -> {
                    Hibernate.initialize(snapshot.getPositionIds());
                    return snapshot.getPositionIds().contains(targetPositionId);
                }).map(SchedulePreferenceShiftOptionSnapshot::getId).sorted().toList();
        boolean shiftOptionsAvailable = !shiftOptionsRequired || !applicableSnapshotIds.isEmpty();
        List<EligibilityProblem> problems = new ArrayList<>();
        if ((schedule.getStatus() == ScheduleStatus.COLLECTING_PREFERENCES
                || schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED)
                && schedule.getPreferenceCollectionMode() == null) {
            problems.add(EligibilityProblem.MISSING_PREFERENCE_MODE);
        }
        if (!shiftOptionsAvailable) problems.add(EligibilityProblem.MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION);

        List<Action> actions = switch (schedule.getStatus()) {
            case COLLECTING_PREFERENCES -> List.of(Action.ADD_TO_COLLECTION, Action.DO_NOT_ADD);
            case PREFERENCES_CLOSED -> List.of(Action.CHANGE_POSITION_AND_REOPEN_COLLECTION,
                    Action.CHANGE_POSITION_WITHOUT_ADDING_TO_THIS_SCHEDULE);
            case DRAFT_FROM_PREFERENCES -> List.of(Action.REOPEN_AND_REBUILD_PREFERENCE_FLOW, Action.DO_NOT_ADD);
            case DRAFT, PUBLISHED -> List.of(Action.INFORMATION_ONLY);
        };
        Instant deadline = schedule.getPreferenceDeadline();
        boolean lessThanSixHours = deadline != null && deadline.isAfter(now)
                && Duration.between(now, deadline).compareTo(Duration.ofHours(6)) < 0;
        return new NewPositionOpportunity(schedule.getId(), schedule.getTitle(), schedule.getStatus(),
                schedule.getVersion(), actions, deadline, lessThanSixHours, schedule.getPreferenceCollectionMode(),
                problems.isEmpty(), shiftOptionsRequired, shiftOptionsAvailable,
                schedule.getPreferenceBuildTemplate() == null ? null : schedule.getPreferenceBuildTemplate().getId(),
                applicableSnapshotIds, schedule.getPreferenceCollectionCycle(), List.copyOf(problems),
                schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED);
    }

}
