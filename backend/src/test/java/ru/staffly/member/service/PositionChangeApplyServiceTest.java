package ru.staffly.member.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.dto.*;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.*;
import ru.staffly.member.repository.*;
import ru.staffly.restaurant.model.*;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.security.SecurityService;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.user.model.User;

import java.time.*;
import java.util.*;

import static org.assertj.core.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PositionChangeApplyServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock PositionRepository positions;
    @Mock ScheduleRepository schedules;
    @Mock ScheduleParticipationRepository participations;
    @Mock SchedulePreferenceSubmissionRepository submissions;
    @Mock SchedulePreferenceLifecycleService lifecycle;
    @Mock PositionChangeAuditRepository audits;
    @Mock MemberMapper memberMapper;
    @Mock SecurityService security;
    @Mock RestaurantTimeService restaurantTime;
    @Mock PublishedShiftImpactClassifier shiftClassifier;
    @Mock CertificationAudienceSyncService certificationSync;
    @Mock PositionChangeNotificationService notifications;

    private PositionChangeApplyService service;
    private Restaurant restaurant;
    private RestaurantMember subject;
    private Position oldPosition;
    private Position target;
    private final Instant createdAt = Instant.parse("2026-01-01T00:00:00Z");

    @BeforeEach void setUp() {
        service = new PositionChangeApplyService(members, positions, schedules, participations, submissions,
                lifecycle, audits, memberMapper, security, restaurantTime, shiftClassifier, certificationSync, notifications);
        restaurant = Restaurant.builder().id(1L).timezone("UTC").build();
        oldPosition = Position.builder().id(10L).name("Официант").restaurant(restaurant).active(true).build();
        target = Position.builder().id(20L).name("Бармен").restaurant(restaurant).active(true).build();
        subject = RestaurantMember.builder().id(7L).restaurant(restaurant).role(RestaurantRole.ADMIN)
                .position(oldPosition).createdAt(createdAt)
                .user(User.builder().id(70L).fullName("Владимир").build()).build();
        lenient().when(members.findForUpdateByIdAndRestaurantId(7L, 1L)).thenReturn(Optional.of(subject));
        lenient().when(positions.findForShareByIdAndRestaurantId(20L, 1L)).thenReturn(Optional.of(target));
        lenient().when(restaurantTime.nowInstant()).thenReturn(Instant.parse("2026-02-01T00:00:00Z"));
        lenient().when(restaurantTime.zoneFor(restaurant)).thenReturn(ZoneOffset.UTC);
        lenient().when(certificationSync.syncRestaurantAudience(1L, 70L)).thenReturn(List.of());
        RestaurantMember actorMember = RestaurantMember.builder().restaurant(restaurant)
                .user(User.builder().id(80L).fullName("Менеджер").build()).build();
        lenient().when(members.findWithUserByUserIdAndRestaurantId(80L, 1L)).thenReturn(Optional.of(actorMember));
    }

    @Test void successfulSimpleChangeSubmitsOnlyEmptyAuthoritativeEffectLists() {
        requestDiscovery(List.of(), target);

        service.apply(1L, 7L, request(List.of()), 80L);

        assertThat(capturedEffects()).isEmpty();
        verify(notifications).submit(eq(subject), eq(members.findWithUserByUserIdAndRestaurantId(80L, 1L).orElseThrow().getUser()),
                any(UUID.class), eq("Официант"), eq("Бармен"), anyList(), eq(List.of()));
    }

    @Test void samePositionIsRejectedBeforeNotificationSubmission() {
        when(positions.findForShareByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(oldPosition));
        var same = new ApplyPositionChangeRequest(10L, 10L, createdAt, List.of());

        assertThatThrownBy(() -> service.apply(1L, 7L, same, 80L)).isInstanceOf(ConflictException.class);

        verifyNoInteractions(notifications);
    }

    @Test void requestedAddDoesNotReportCreationWhenLifecycleReportsNoCreation() {
        Schedule schedule = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        prepare(schedule, PositionChangeImpactPlan.Action.ADD_TO_COLLECTION, null);
        when(lifecycle.addParticipantWithLocksHeld(schedule, subject, 80L, "Смена должности")).thenReturn(false);

        service.apply(1L, 7L, request(List.of(decision(schedule,
                PositionChangeImpactPlan.Action.ADD_TO_COLLECTION, null))), 80L);

        assertThat(capturedEffects()).isEmpty();
    }

    @Test void removalEffectsComeFromBothSuccessfulLifecycleDeletes() {
        Schedule schedule = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        observeOldParticipationAndSubmission(schedule);
        prepare(schedule, PositionChangeImpactPlan.Action.DO_NOT_ADD, null);
        when(lifecycle.removeParticipantWithLocksHeld(schedule, subject, 80L, "Смена должности"))
                .thenReturn(new SchedulePreferenceLifecycleService.RemoveParticipantMutationResult(true, true));

        service.apply(1L, 7L, request(List.of(decision(schedule,
                PositionChangeImpactPlan.Action.DO_NOT_ADD, null, 31L, 41L, 2))), 80L);

        assertThat(capturedEffects()).singleElement().satisfies(effect -> assertThat(effect.consequences())
                .containsExactlyInAnyOrder(PositionChangeScheduleEffectType.OLD_PARTICIPATION_REMOVED,
                        PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED));
    }

    @Test void preObservedParticipationDoesNotCreateEffectWhenLifecycleReportsOnlySubmissionRemoved() {
        Schedule schedule = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        observeOldParticipationAndSubmission(schedule);
        prepare(schedule, PositionChangeImpactPlan.Action.DO_NOT_ADD, null);
        when(lifecycle.removeParticipantWithLocksHeld(schedule, subject, 80L, "Смена должности"))
                .thenReturn(new SchedulePreferenceLifecycleService.RemoveParticipantMutationResult(false, true));

        service.apply(1L, 7L, request(List.of(decision(schedule,
                PositionChangeImpactPlan.Action.DO_NOT_ADD, null, 31L, 41L, 2))), 80L);

        assertThat(capturedEffects()).singleElement().satisfies(effect -> assertThat(effect.consequences())
                .containsExactly(PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED));
    }

    @Test void preObservedSubmissionDoesNotCreateEffectWhenLifecycleReportsOnlyParticipationRemoved() {
        Schedule schedule = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        observeOldParticipationAndSubmission(schedule);
        prepare(schedule, PositionChangeImpactPlan.Action.DO_NOT_ADD, null);
        when(lifecycle.removeParticipantWithLocksHeld(schedule, subject, 80L, "Смена должности"))
                .thenReturn(new SchedulePreferenceLifecycleService.RemoveParticipantMutationResult(true, false));

        service.apply(1L, 7L, request(List.of(decision(schedule,
                PositionChangeImpactPlan.Action.DO_NOT_ADD, null, 31L, 41L, 2))), 80L);

        assertThat(capturedEffects()).singleElement().satisfies(effect -> assertThat(effect.consequences())
                .containsExactly(PositionChangeScheduleEffectType.OLD_PARTICIPATION_REMOVED));
    }

    @Test void reopenUsesMutationResultForCreationAndAutoBuildInvalidation() {
        Schedule schedule = schedule(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        Instant deadline = Instant.parse("2026-03-01T00:00:00Z");
        prepare(schedule, PositionChangeImpactPlan.Action.REOPEN_AND_REBUILD_PREFERENCE_FLOW, deadline);
        when(lifecycle.reopenWithLocksHeld(schedule, subject, deadline, 80L, "Смена должности"))
                .thenReturn(new SchedulePreferenceLifecycleService.ReopenMutationResult(false, false));

        service.apply(1L, 7L, request(List.of(decision(schedule,
                PositionChangeImpactPlan.Action.REOPEN_AND_REBUILD_PREFERENCE_FLOW, deadline))), 80L);

        assertThat(capturedEffects()).singleElement().satisfies(effect -> assertThat(effect.consequences())
                .containsExactly(PositionChangeScheduleEffectType.COLLECTION_REOPENED));
    }

    @Test void matchingDraftRowAndPositivePublishedCancellationAreReportedButAbsentOrZeroAreSilent() {
        Schedule draftWithRow = schedule(101L, ScheduleStatus.DRAFT);
        draftWithRow.getRows().add(ScheduleRow.builder().schedule(draftWithRow).memberId(7L).positionId(10L)
                .cells(new ArrayList<>()).build());
        Schedule draftWithoutRow = schedule(102L, ScheduleStatus.DRAFT);
        Schedule publishedCanceled = schedule(103L, ScheduleStatus.PUBLISHED);
        ScheduleRow canceledRow = ScheduleRow.builder().schedule(publishedCanceled).memberId(7L).positionId(10L)
                .cells(new ArrayList<>()).build();
        publishedCanceled.getRows().add(canceledRow);
        Schedule publishedZero = schedule(104L, ScheduleStatus.PUBLISHED);
        ScheduleRow zeroRow = ScheduleRow.builder().schedule(publishedZero).memberId(7L).positionId(10L)
                .cells(new ArrayList<>()).build();
        publishedZero.getRows().add(zeroRow);
        List<Schedule> all = List.of(draftWithRow, draftWithoutRow, publishedCanceled, publishedZero);
        requestDiscovery(all, target);
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(eq(1L), anyList())).thenReturn(all);
        when(shiftClassifier.cancelFuture(canceledRow.getCells(), LocalDateTime.of(2026, 2, 1, 0, 0))).thenReturn(3);
        when(shiftClassifier.cancelFuture(zeroRow.getCells(), LocalDateTime.of(2026, 2, 1, 0, 0))).thenReturn(0);
        List<ApplyPositionChangeRequest.ScheduleDecision> decisions = all.stream()
                .map(s -> decision(s, PositionChangeImpactPlan.Action.INFORMATION_ONLY, null)).toList();

        service.apply(1L, 7L, request(decisions), 80L);

        assertThat(capturedEffects()).extracting(AppliedPositionChangeScheduleEffect::scheduleId).containsExactly(101L, 103L);
        assertThat(capturedEffects()).filteredOn(e -> e.scheduleId().equals(101L)).singleElement()
                .extracting(AppliedPositionChangeScheduleEffect::consequences)
                .isEqualTo(Set.of(PositionChangeScheduleEffectType.DRAFT_EMPLOYEE_REMOVED));
        assertThat(capturedEffects()).filteredOn(e -> e.scheduleId().equals(103L)).singleElement()
                .satisfies(e -> {
                    assertThat(e.consequences()).containsExactly(PositionChangeScheduleEffectType.PUBLISHED_FUTURE_SHIFTS_CANCELLED);
                    assertThat(e.cancelledFutureShiftCount()).isEqualTo(3);
                });
    }

    private void prepare(Schedule schedule, PositionChangeImpactPlan.Action action, Instant deadline) {
        requestDiscovery(List.of(schedule), target);
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L, List.of(schedule.getId())))
                .thenReturn(List.of(schedule));
    }
    private void observeOldParticipationAndSubmission(Schedule schedule) {
        ScheduleParticipation participation = ScheduleParticipation.builder().id(31L).schedule(schedule)
                .member(subject).positionId(10L).build();
        SchedulePreferenceSubmission submission = SchedulePreferenceSubmission.builder().id(41L).schedule(schedule)
                .member(subject).positionId(10L).revision(2).build();
        when(participations.findByScheduleIdAndMemberId(schedule.getId(), 7L))
                .thenReturn(Optional.of(participation));
        when(submissions.findByScheduleIdAndMemberId(schedule.getId(), 7L))
                .thenReturn(Optional.of(submission));
    }
    private void requestDiscovery(List<Schedule> affected, Position newPosition) {
        when(schedules.findByRestaurantIdAndParticipantMemberId(1L, 7L)).thenReturn(affected);
        when(schedules.findByRestaurantIdAndRowMemberId(1L, 7L)).thenReturn(List.of());
        when(schedules.findByRestaurantIdAndPositionId(1L, newPosition.getId())).thenReturn(affected);
    }
    private ApplyPositionChangeRequest request(List<ApplyPositionChangeRequest.ScheduleDecision> decisions) {
        return new ApplyPositionChangeRequest(20L, 10L, createdAt, decisions);
    }
    private ApplyPositionChangeRequest.ScheduleDecision decision(Schedule schedule,
            PositionChangeImpactPlan.Action action, Instant deadline) {
        return decision(schedule, action, deadline, null, null, null);
    }
    private ApplyPositionChangeRequest.ScheduleDecision decision(Schedule schedule,
            PositionChangeImpactPlan.Action action, Instant deadline, Long participationId,
            Long submissionId, Integer revision) {
        return new ApplyPositionChangeRequest.ScheduleDecision(schedule.getId(), schedule.getVersion(),
                schedule.getStatus(), schedule.getPreferenceCollectionCycle(), schedule.getPreferenceDeadline(),
                participationId, submissionId, revision, action, deadline);
    }
    private Schedule schedule(ScheduleStatus status) { return schedule(100L, status); }
    private Schedule schedule(Long id, ScheduleStatus status) {
        return Schedule.builder().id(id).version(1L).restaurant(restaurant).title("График " + id).status(status)
                .positions(new LinkedHashSet<>(List.of(target))).rows(new ArrayList<>())
                .preferenceShiftOptionSnapshots(new ArrayList<>()).preferenceCollectionCycle(1).build();
    }
    @SuppressWarnings("unchecked")
    private List<AppliedPositionChangeScheduleEffect> capturedEffects() {
        ArgumentCaptor<List<AppliedPositionChangeScheduleEffect>> captor = ArgumentCaptor.forClass(List.class);
        verify(notifications).submit(eq(subject), any(User.class), any(UUID.class), eq("Официант"), eq("Бармен"),
                captor.capture(), anyList());
        return captor.getValue();
    }
}
