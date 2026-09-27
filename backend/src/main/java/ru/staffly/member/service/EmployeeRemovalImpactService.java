package ru.staffly.member.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;
import ru.staffly.member.dto.PublishedShiftImpact;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.time.Instant;
import java.time.LocalDateTime;
import java.util.Map;
import java.util.TreeMap;

@Service
@RequiredArgsConstructor
public class EmployeeRemovalImpactService {
    private final RestaurantMemberRepository members;
    private final ScheduleRepository schedules;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final MemberRemovalPolicyService removalPolicy;
    private final RestaurantTimeService restaurantTime;
    private final PublishedShiftImpactClassifier shiftClassifier;

    @Transactional(Transactional.TxType.SUPPORTS)
    public EmployeeRemovalImpactPlan calculate(Long restaurantId, Long memberId, Long currentUserId) {
        RestaurantMember member = members.findWithUserAndPositionByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        removalPolicy.assertCanStartRemoval(restaurantId, currentUserId, member);

        Instant now = restaurantTime.nowInstant();
        LocalDateTime localNow = LocalDateTime.ofInstant(now, restaurantTime.zoneFor(member.getRestaurant()));
        Map<Long, Schedule> affected = new TreeMap<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId)
                .forEach(schedule -> affected.put(schedule.getId(), schedule));
        schedules.findByRestaurantIdAndSubmissionMemberId(restaurantId, memberId)
                .forEach(schedule -> affected.put(schedule.getId(), schedule));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId)
                .forEach(schedule -> affected.put(schedule.getId(), schedule));

        var position = member.getPosition() == null ? null : new EmployeeRemovalImpactPlan.Position(
                member.getPosition().getId(), member.getPosition().getName());
        var employee = new EmployeeRemovalImpactPlan.Employee(member.getId(), member.getUser().getFullName(),
                position, member.getCreatedAt());
        var impacts = affected.values().stream().map(schedule -> impact(schedule, memberId, localNow)).toList();
        return new EmployeeRemovalImpactPlan(now, employee, impacts);
    }

    private EmployeeRemovalImpactPlan.ScheduleImpact impact(Schedule schedule, Long memberId,
                                                              LocalDateTime localNow) {
        Hibernate.initialize(schedule.getRows());
        ScheduleParticipation participation = participations
                .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        SchedulePreferenceSubmission submission = submissions
                .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        ScheduleRow row = schedule.getRows().stream()
                .filter(candidate -> memberId.equals(candidate.getMemberId())).findFirst().orElse(null);
        ScheduleStatus status = schedule.getStatus();
        boolean preferenceLifecycle = status == ScheduleStatus.COLLECTING_PREFERENCES
                || status == ScheduleStatus.PREFERENCES_CLOSED
                || status == ScheduleStatus.DRAFT_FROM_PREFERENCES;
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
                preferenceLifecycle && participation != null,
                preferenceLifecycle && submission != null,
                status == ScheduleStatus.COLLECTING_PREFERENCES && participation != null,
                status == ScheduleStatus.DRAFT_FROM_PREFERENCES,
                status == ScheduleStatus.DRAFT && activeRow,
                publishedActiveRow,
                shiftImpact);
    }
}
