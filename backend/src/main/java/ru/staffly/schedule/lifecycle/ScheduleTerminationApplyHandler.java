package ru.staffly.schedule.lifecycle;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.ScheduleToken;
import ru.staffly.member.lifecycle.TerminationApplyContext;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.service.PublishedShiftImpactClassifier;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;

import java.time.LocalDateTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ScheduleTerminationApplyHandler {
    private static final String STALE = "EMPLOYEE_REMOVAL_PLAN_STALE: refresh the impact plan";
    private final ScheduleRepository schedules;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final SchedulePreferenceLifecycleService lifecycle;
    private final PublishedShiftImpactClassifier shiftClassifier;
    private final RestaurantTimeService restaurantTime;

    public ScheduleTerminationResult apply(TerminationApplyContext context, ScheduleTerminationDecision decision) {
        RestaurantMember member = context.target();
        Long restaurantId = context.restaurantId();
        Long memberId = member.getId();
        Map<Long, ScheduleToken> tokens;
        try {
            tokens = decision.tokens().stream().collect(Collectors.toMap(ScheduleToken::scheduleId, Function.identity()));
        } catch (RuntimeException ex) {
            throw new BadRequestException("Each affected schedule must have exactly one token");
        }
        Set<Long> affected = affectedScheduleIds(restaurantId, memberId);
        if (!affected.equals(tokens.keySet())) throw stale();
        // Coordinator already owns the member lock. Module locks follow in ascending schedule id order.
        List<Schedule> locked = affected.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, new ArrayList<>(affected));
        if (locked.size() != affected.size()) throw stale();
        if (!affected.equals(affectedScheduleIds(restaurantId, memberId))) throw stale();
        locked.forEach(schedule -> validateToken(schedule, tokens.get(schedule.getId()), memberId));

        LocalDateTime localNow = LocalDateTime.ofInstant(context.now(), restaurantTime.zoneFor(member.getRestaurant()));
        int cancelled = 0, historical = 0, removedSubmissions = 0, removedParticipations = 0, invalidatedDrafts = 0;
        for (Schedule schedule : locked) {
            ScheduleParticipation participation = participations.findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
            SchedulePreferenceSubmission submission = submissions.findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
            if (participation != null || submission != null) {
                lifecycle.removeParticipantWithLocksHeld(schedule, member, context.actorUserId(), "Удаление сотрудника");
                removedParticipations += participation == null ? 0 : 1;
                removedSubmissions += submission == null ? 0 : 1;
            }
            ScheduleRow row = activeRow(schedule, memberId);
            switch (schedule.getStatus()) {
                case DRAFT -> { if (row != null) schedule.getRows().remove(row); }
                case DRAFT_FROM_PREFERENCES -> {
                    lifecycle.invalidateAppliedPreferenceDraftWithLocksHeld(schedule, context.actorUserId(), "Удаление участника");
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
                case COLLECTING_PREFERENCES, PREFERENCES_CLOSED -> { }
            }
            schedule.setUpdatedAt(context.now());
        }
        schedules.saveAll(locked);
        return new ScheduleTerminationResult(List.copyOf(affected), cancelled, historical,
                removedSubmissions, removedParticipations, invalidatedDrafts);
    }

    private Set<Long> affectedScheduleIds(Long restaurantId, Long memberId) {
        Set<Long> result = new TreeSet<>();
        schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, memberId).forEach(s -> result.add(s.getId()));
        schedules.findByRestaurantIdAndSubmissionMemberId(restaurantId, memberId).forEach(s -> result.add(s.getId()));
        schedules.findByRestaurantIdAndRowMemberId(restaurantId, memberId).forEach(s -> result.add(s.getId()));
        return result;
    }
    private void validateToken(Schedule schedule, ScheduleToken token, Long memberId) {
        if (token == null || !Objects.equals(schedule.getVersion(), token.expectedVersion())
                || schedule.getStatus() != token.expectedStatus()
                || schedule.getPreferenceCollectionCycle() != token.expectedCollectionCycle()
                || !Objects.equals(schedule.getPreferenceDeadline(), token.expectedPreferenceDeadline())) throw stale();
        ScheduleParticipation participation = participations.findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        SchedulePreferenceSubmission submission = submissions.findByScheduleIdAndMemberId(schedule.getId(), memberId).orElse(null);
        if (!Objects.equals(participation == null ? null : participation.getId(), token.expectedParticipationId())
                || !Objects.equals(submission == null ? null : submission.getId(), token.expectedPreferenceSubmissionId())
                || !Objects.equals(submission == null ? null : submission.getRevision(), token.expectedPreferenceSubmissionRevision())) throw stale();
        Hibernate.initialize(schedule.getRows());
    }
    private ScheduleRow activeRow(Schedule schedule, Long memberId) {
        return schedule.getRows().stream().filter(row -> Objects.equals(row.getMemberId(), memberId) && !row.isHistorical())
                .findFirst().orElse(null);
    }
    private ConflictException stale() { return new ConflictException(STALE, Map.of("code", "EMPLOYEE_REMOVAL_PLAN_STALE")); }
}
