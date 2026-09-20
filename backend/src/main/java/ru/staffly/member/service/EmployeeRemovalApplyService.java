package ru.staffly.member.service;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.ScheduleToken;
import ru.staffly.member.dto.ApplyEmployeeRemovalResult;
import ru.staffly.member.model.EmployeeRemovalAudit;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.EmployeeRemovalAuditRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffService;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.training.service.CertificationAudienceSyncService;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class EmployeeRemovalApplyService {
    private static final String STALE = "EMPLOYEE_REMOVAL_PLAN_STALE: refresh the impact plan";

    private final RestaurantMemberRepository members;
    private final ScheduleRepository schedules;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final SchedulePreferenceLifecycleService lifecycle;
    private final MemberRemovalPolicyService removalPolicy;
    private final MemberResponsibilityHandoffService responsibilityHandoff;
    private final PublishedShiftImpactClassifier shiftClassifier;
    private final RestaurantTimeService restaurantTime;
    private final EmployeeRemovalAuditRepository audits;
    private final CertificationAudienceSyncService certificationAudienceSync;

    /** The lock, validation, cleanup, member deletion and audit all share this transaction. */
    @Transactional
    public ApplyEmployeeRemovalResult apply(Long restaurantId, Long memberId,
                                             ApplyEmployeeRemovalRequest request, Long actorUserId) {
        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(this::stale);
        removalPolicy.assertCanCompleteRemoval(restaurantId, actorUserId, member);
        if (member.getUser() != null) {
            responsibilityHandoff.assertNoBlockingResponsibilities(restaurantId, member.getUser().getId());
        }
        if (!Objects.equals(member.getCreatedAt(), request.expectedMemberCreatedAt())
                || !Objects.equals(positionId(member), request.expectedCurrentPositionId())) throw stale();

        Map<Long, ScheduleToken> tokens;
        try {
            tokens = request.schedules().stream().collect(Collectors.toMap(
                    ScheduleToken::scheduleId, Function.identity()));
        } catch (RuntimeException ex) {
            throw new BadRequestException("Each affected schedule must have exactly one token");
        }

        Set<Long> affected = affectedScheduleIds(restaurantId, memberId);
        if (!affected.equals(tokens.keySet())) throw stale();

        // Global order: member above, followed by all schedules in ascending id order.
        List<Schedule> locked = affected.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, new ArrayList<>(affected));
        if (locked.size() != affected.size()) throw stale();

        // Discovery queries can race before schedule locks; repeat the complete union under the locks.
        if (!affected.equals(affectedScheduleIds(restaurantId, memberId))) throw stale();
        locked.forEach(schedule -> validateToken(schedule, tokens.get(schedule.getId()), memberId));

        LocalDateTime localNow = LocalDateTime.ofInstant(restaurantTime.nowInstant(),
                restaurantTime.zoneFor(member.getRestaurant()));
        int cancelled = 0;
        int historical = 0;
        int removedSubmissions = 0;
        int removedParticipations = 0;
        int invalidatedDrafts = 0;

        for (Schedule schedule : locked) {
            ScheduleParticipation participation = participations
                    .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
            SchedulePreferenceSubmission submission = submissions
                    .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
            if (participation != null || submission != null) {
                lifecycle.removeParticipantWithLocksHeld(schedule, member, actorUserId, "Удаление сотрудника");
                removedParticipations += participation == null ? 0 : 1;
                removedSubmissions += submission == null ? 0 : 1;
            }

            ScheduleRow row = activeRow(schedule, memberId);
            switch (schedule.getStatus()) {
                case DRAFT -> {
                    if (row != null) schedule.getRows().remove(row);
                }
                case DRAFT_FROM_PREFERENCES -> {
                    lifecycle.invalidateAppliedPreferenceDraftWithLocksHeld(
                            schedule, actorUserId, "Удаление участника");
                    invalidatedDrafts++;
                }
                case PUBLISHED -> {
                    if (row != null) {
                        Hibernate.initialize(row.getCells());
                        cancelled += shiftClassifier.cancelFuture(row.getCells(), localNow);
                        row.setHistorical(true);
                        historical++;
                    }
                }
                case COLLECTING_PREFERENCES, PREFERENCES_CLOSED -> { /* participant input only */ }
            }
            schedule.setUpdatedAt(restaurantTime.nowInstant());
        }
        schedules.saveAll(locked);

        Long previousPositionId = positionId(member);
        members.delete(member);
        audits.save(EmployeeRemovalAudit.builder()
                .restaurantId(restaurantId).actorUserId(actorUserId).memberId(memberId)
                .previousPositionId(previousPositionId).occurredAt(restaurantTime.nowInstant())
                .affectedScheduleIds(affected.toString())
                .removedParticipationCount(removedParticipations)
                .removedSubmissionCount(removedSubmissions)
                .invalidatedPreferenceDraftCount(invalidatedDrafts)
                .historicalPublishedRowCount(historical)
                .cancelledFutureShiftCount(cancelled).build());
        certificationAudienceSync.syncRestaurantAudience(restaurantId);

        return new ApplyEmployeeRemovalResult(memberId, List.copyOf(affected), cancelled, historical,
                removedSubmissions, removedParticipations, invalidatedDrafts);
    }

    private Set<Long> affectedScheduleIds(Long restaurantId, Long memberId) {
        Set<Long> result = new TreeSet<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId)
                .forEach(schedule -> result.add(schedule.getId()));
        schedules.findByRestaurantIdAndSubmissionMemberId(restaurantId, memberId)
                .forEach(schedule -> result.add(schedule.getId()));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId)
                .forEach(schedule -> result.add(schedule.getId()));
        return result;
    }

    private void validateToken(Schedule schedule, ScheduleToken token, Long memberId) {
        if (token == null || !Objects.equals(schedule.getVersion(), token.expectedVersion())
                || schedule.getStatus() != token.expectedStatus()
                || schedule.getPreferenceCollectionCycle() != token.expectedCollectionCycle()
                || !Objects.equals(schedule.getPreferenceDeadline(), token.expectedPreferenceDeadline())) throw stale();
        ScheduleParticipation participation = participations
                .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        SchedulePreferenceSubmission submission = submissions
                .findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        if (!Objects.equals(participation == null ? null : participation.getId(), token.expectedParticipationId())
                || !Objects.equals(submission == null ? null : submission.getId(), token.expectedPreferenceSubmissionId())
                || !Objects.equals(submission == null ? null : submission.getRevision(),
                token.expectedPreferenceSubmissionRevision())) throw stale();
        Hibernate.initialize(schedule.getRows());
    }

    private ScheduleRow activeRow(Schedule schedule, Long memberId) {
        return schedule.getRows().stream()
                .filter(row -> Objects.equals(row.getMemberId(), memberId) && !row.isHistorical())
                .findFirst().orElse(null);
    }

    private Long positionId(RestaurantMember member) {
        return member.getPosition() == null ? null : member.getPosition().getId();
    }

    private ConflictException stale() {
        return new ConflictException(STALE, Map.of("code", "EMPLOYEE_REMOVAL_PLAN_STALE"));
    }
}
