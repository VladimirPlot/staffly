package ru.staffly.schedule.lifecycle;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;
import ru.staffly.member.dto.PublishedShiftImpact;
import ru.staffly.member.service.PublishedShiftImpactClassifier;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.lifecycle.TerminationPreviewContext;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleOwnershipService;

import java.time.LocalDateTime;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class ScheduleTerminationPreviewHandler {
    private final ScheduleRepository schedules;
    private final RestaurantTimeService restaurantTime;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final PublishedShiftImpactClassifier shiftClassifier;
    private final ScheduleOwnershipService ownership;

    @Transactional(Transactional.TxType.SUPPORTS)
    public ScheduleTerminationImpact preview(TerminationPreviewContext context) {
        RestaurantMember member = context.target();
        Long restaurantId = context.restaurantId();
        Long memberId = member.getId();
        LocalDateTime localNow = LocalDateTime.ofInstant(context.now(), restaurantTime.zoneFor(member.getRestaurant()));
        Map<Long, Schedule> affected = new TreeMap<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId)
                .forEach(schedule -> affected.put(schedule.getId(), schedule));
        schedules.findByRestaurantIdAndSubmissionMemberId(restaurantId, memberId)
                .forEach(schedule -> affected.put(schedule.getId(), schedule));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId)
                .forEach(schedule -> affected.put(schedule.getId(), schedule));
        var owned = ownership.findActiveOrFutureOwnedSchedules(restaurantId, member.getUser().getId());
        var candidates = owned.isEmpty() ? java.util.List.<ru.staffly.schedule.dto.ScheduleOwnerDto>of()
                : ownership.getHandoffOwnerCandidates(restaurantId, context.actorUserId(), member.getUser().getId());
        var candidateDtos = candidates.stream().map(c -> new EmployeeRemovalImpactPlan.Candidate(
                c.memberId(), c.userId(), c.displayName(), c.positionName())).toList();
        var ownerImpacts = owned.stream().map(schedule -> new EmployeeRemovalImpactPlan.OwnershipResource(
                schedule.getId(), schedule.getTitle(), schedule.getVersion(), member.getUser().getId(), candidateDtos)).toList();
        return new ScheduleTerminationImpact(affected.values().stream()
                .map(schedule -> impact(schedule, memberId, localNow)).toList(), ownerImpacts);
    }

    private EmployeeRemovalImpactPlan.ScheduleImpact impact(Schedule schedule, Long memberId,
                                                              LocalDateTime localNow) {
        Hibernate.initialize(schedule.getRows());
        ScheduleParticipation participation = participations
                .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        SchedulePreferenceSubmission submission = submissions
                .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        ScheduleRow row = schedule.getRows().stream()
                .filter(candidate -> memberId.equals(candidate.getMemberId()) && !candidate.isHistorical()).findFirst().orElse(null);
        ScheduleStatus status = schedule.getStatus();
        boolean draft = status == ScheduleStatus.DRAFT || status == ScheduleStatus.DRAFT_FROM_PREFERENCES;
        boolean activeRow = row != null && !row.isHistorical();
        boolean publishedActiveRow = status == ScheduleStatus.PUBLISHED && activeRow;
        PublishedShiftImpact shiftImpact = null;
        if (publishedActiveRow) {
            Hibernate.initialize(row.getCells());
            shiftImpact = shiftClassifier.classify(row.getCells(), localNow);
        }

        return new EmployeeRemovalImpactPlan.ScheduleImpact(
                schedule.getId(), schedule.getTitle(), status, schedule.getVersion(),
                schedule.getPreferenceCollectionCycle(), schedule.getPreferenceDeadline(),
                participation == null ? null : participation.getId(),
                submission == null ? null : submission.getId(),
                submission == null ? null : submission.getRevision(),
                participation != null,
                submission != null,
                status == ScheduleStatus.COLLECTING_PREFERENCES && participation != null,
                status == ScheduleStatus.DRAFT_FROM_PREFERENCES,
                draft && activeRow,
                publishedActiveRow,
                shiftImpact);
    }
}
