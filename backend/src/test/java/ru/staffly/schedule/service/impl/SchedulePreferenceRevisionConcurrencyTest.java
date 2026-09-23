package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import org.springframework.http.HttpStatus;
import ru.staffly.common.exception.GlobalExceptionHandler;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.dto.SchedulePreferenceCellRequest;
import ru.staffly.schedule.dto.SchedulePreferenceMyResponse;
import ru.staffly.schedule.dto.UpsertMySchedulePreferenceRequest;
import ru.staffly.schedule.exception.ScheduleDomainConflictException;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleParticipation;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.verifyNoInteractions;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SchedulePreferenceRevisionConcurrencyTest {

    private static final long RESTAURANT_ID = 10L;
    private static final long SCHEDULE_ID = 20L;
    private static final long MEMBER_ID = 30L;
    private static final long USER_ID = 40L;
    private static final LocalDate DAY = LocalDate.of(2026, 9, 24);

    @Mock private ScheduleRepository schedules;
    @Mock private SchedulePreferenceSubmissionRepository submissions;
    @Mock private ScheduleParticipationRepository participations;
    @Mock private RestaurantMemberRepository members;
    @Mock private SecurityService securityService;
    @Mock private ScheduleAccessService scheduleAccessService;
    @Mock private InboxMessageService inboxMessages;
    @Mock private UserRepository users;

    private SchedulePreferenceServiceImpl service;
    private Schedule schedule;
    private RestaurantMember member;
    private ScheduleParticipation participation;

    @BeforeEach
    void setUp() {
        service = new SchedulePreferenceServiceImpl(schedules, submissions, participations, members,
                securityService, scheduleAccessService, inboxMessages, users);
        Restaurant restaurant = Restaurant.builder().id(RESTAURANT_ID).build();
        User user = User.builder().id(USER_ID).firstName("Иван").lastName("Иванов").fullName("Иван Иванов").build();
        member = RestaurantMember.builder().id(MEMBER_ID).restaurant(restaurant).user(user).build();
        schedule = Schedule.builder()
                .id(SCHEDULE_ID)
                .restaurant(restaurant)
                .title("Неделя")
                .startDate(DAY)
                .endDate(DAY)
                .status(ScheduleStatus.COLLECTING_PREFERENCES)
                .preferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL)
                .preferenceDeadline(Instant.parse("2099-01-01T00:00:00Z"))
                .preferenceCollectionCycle(1)
                .build();
        participation = ScheduleParticipation.builder()
                .schedule(schedule).member(member).positionId(50L).positionName("Официант").build();

        when(schedules.findForUpdateByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));
        when(members.findByUserIdAndRestaurantIdWithPosition(USER_ID, RESTAURANT_ID)).thenReturn(Optional.of(member));
        when(participations.findByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID)).thenReturn(Optional.of(participation));
        lenient().when(participations.findByScheduleIdOrderById(SCHEDULE_ID)).thenReturn(List.of());
        lenient().when(submissions.saveAndFlush(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void firstSubmissionRequiresZeroAndStartsAtRevisionOne() {
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID)).thenReturn(Optional.empty());

        SchedulePreferenceMyResponse response = service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID, request(0, "first"));

        assertThat(response.revision()).isEqualTo(1);
        assertThat(response.periodComment()).isEqualTo("first");
    }

    @Test
    void matchingExistingRevisionIncrementsExactlyOnce() {
        SchedulePreferenceSubmission submission = submission(4, "old");
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID))
                .thenReturn(Optional.of(submission));

        SchedulePreferenceMyResponse response = service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID, request(4, "new"));

        assertThat(response.revision()).isEqualTo(5);
        assertThat(submission.getRevision()).isEqualTo(5);
        assertThat(submission.getPeriodComment()).isEqualTo("new");
    }

    @Test
    void matchingRevisionDiffsCellsByDayWithoutReplacingRetainedIdentity() {
        LocalDate omittedDay = DAY.plusDays(1);
        LocalDate newDay = DAY.plusDays(2);
        schedule.setEndDate(newDay);
        SchedulePreferenceSubmission submission = submission(4, "old");
        SchedulePreferenceCell retainedCell = submission.getCells().get(0);
        SchedulePreferenceCell omittedCell = SchedulePreferenceCell.builder()
                .id(101L).day(omittedDay).type(SchedulePreferenceType.UNAVAILABLE).fullDay(true).build();
        omittedCell.setSubmission(submission);
        submission.getCells().add(omittedCell);
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID))
                .thenReturn(Optional.of(submission));

        SchedulePreferenceMyResponse response = service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID,
                new UpsertMySchedulePreferenceRequest(4, List.of(
                        cellRequest(DAY, SchedulePreferenceType.PREFER_DAY_OFF, "updated"),
                        cellRequest(newDay, SchedulePreferenceType.AVAILABLE, "new")
                ), "new comment"));

        assertThat(response.revision()).isEqualTo(5);
        assertThat(submission.getCells()).hasSize(2);
        assertThat(submission.getCells()).extracting(SchedulePreferenceCell::getDay)
                .containsExactlyInAnyOrder(DAY, newDay);
        assertThat(submission.getCells()).extracting(SchedulePreferenceCell::getDay).doesNotHaveDuplicates();
        SchedulePreferenceCell updated = submission.getCells().stream()
                .filter(cell -> DAY.equals(cell.getDay())).findFirst().orElseThrow();
        assertThat(updated).isSameAs(retainedCell);
        assertThat(updated.getId()).isEqualTo(100L);
        assertThat(updated.getSubmission()).isSameAs(submission);
        assertThat(updated.getType()).isEqualTo(SchedulePreferenceType.PREFER_DAY_OFF);
        assertThat(updated.isFullDay()).isTrue();
        assertThat(updated.getStartTime()).isNull();
        assertThat(updated.getEndTime()).isNull();
        assertThat(updated.getNote()).isEqualTo("updated");
        assertThat(updated.getSortOrder()).isZero();
        SchedulePreferenceCell added = submission.getCells().stream()
                .filter(cell -> newDay.equals(cell.getDay())).findFirst().orElseThrow();
        assertThat(added.getId()).isNull();
        assertThat(added.getSubmission()).isSameAs(submission);
        assertThat(added.getSortOrder()).isEqualTo(1);
        assertThat(submission.getCells()).doesNotContain(omittedCell);
    }

    @Test
    void staleUpdateCannotMutateSubmissionOrTriggerSideEffects() {
        SchedulePreferenceSubmission submission = submission(5, "authoritative");
        SchedulePreferenceCell originalCell = submission.getCells().get(0);
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID))
                .thenReturn(Optional.of(submission));

        assertThatThrownBy(() -> service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID, request(4, "stale")))
                .isInstanceOfSatisfying(ScheduleDomainConflictException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo("SCHEDULE_PREFERENCE_REVISION_CONFLICT"));

        assertThat(submission.getRevision()).isEqualTo(5);
        assertThat(submission.getPeriodComment()).isEqualTo("authoritative");
        assertThat(submission.getCells()).containsExactly(originalCell);
        verify(submissions, never()).saveAndFlush(any());
        verify(schedules, never()).flush();
        verify(participations, never()).findByScheduleIdOrderById(any());
        verifyNoInteractions(inboxMessages);
    }

    @Test
    void nonZeroRevisionConflictsWhenSubmissionDoesNotExist() {
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID)).thenReturn(Optional.empty());

        assertRevisionConflict(() -> service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID, request(1, "invalid first write")));
        verify(submissions, never()).saveAndFlush(any());
    }

    @Test
    void zeroRevisionConflictsWhenSubmissionExists() {
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID))
                .thenReturn(Optional.of(submission(1, "existing")));

        assertRevisionConflict(() -> service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID, request(0, "stale")));
        verify(submissions, never()).saveAndFlush(any());
    }

    @Test
    void revisionConflictHasDedicatedHttp409Response() {
        ScheduleDomainConflictException conflict = new ScheduleDomainConflictException(
                "SCHEDULE_PREFERENCE_REVISION_CONFLICT", "safe message");

        var response = new GlobalExceptionHandler().handleScheduleDomainConflict(conflict);

        assertThat(response.getStatusCode()).isEqualTo(HttpStatus.CONFLICT);
        assertThat(response.getBody()).isNotNull();
        assertThat(response.getBody().getError()).isEqualTo("SCHEDULE_PREFERENCE_REVISION_CONFLICT");
        assertThat(response.getBody().getMeta()).isNull();
    }

    @Test
    void reopenCycleIsExposedWithoutInvalidatingSubmissionRevisionOrCells() {
        SchedulePreferenceSubmission submission = submission(3, "preserved");
        SchedulePreferenceCell originalCell = submission.getCells().get(0);
        schedule.setPreferenceCollectionCycle(2);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));
        when(submissions.findWithCellsByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID))
                .thenReturn(Optional.of(submission));
        when(submissions.findForUpdateByScheduleIdAndMemberId(SCHEDULE_ID, MEMBER_ID))
                .thenReturn(Optional.of(submission));

        SchedulePreferenceMyResponse afterReopen = service.getMyPreference(RESTAURANT_ID, SCHEDULE_ID, USER_ID);
        assertThat(afterReopen.preferenceCollectionCycle()).isEqualTo(2);
        assertThat(afterReopen.revision()).isEqualTo(3);
        assertThat(submission.getCells()).containsExactly(originalCell);

        SchedulePreferenceMyResponse afterEdit = service.upsertMyPreference(
                RESTAURANT_ID, SCHEDULE_ID, USER_ID, request(afterReopen.revision(), "after reopen"));
        assertThat(afterEdit.preferenceCollectionCycle()).isEqualTo(2);
        assertThat(afterEdit.revision()).isEqualTo(4);
    }

    private SchedulePreferenceSubmission submission(int revision, String comment) {
        SchedulePreferenceCell cell = SchedulePreferenceCell.builder()
                .id(100L).day(DAY).type(SchedulePreferenceType.AVAILABLE).fullDay(true).build();
        SchedulePreferenceSubmission submission = SchedulePreferenceSubmission.builder()
                .id(200L).schedule(schedule).member(member).revision(revision).periodComment(comment)
                .cells(new ArrayList<>()).build();
        cell.setSubmission(submission);
        submission.getCells().add(cell);
        return submission;
    }

    private UpsertMySchedulePreferenceRequest request(int expectedRevision, String comment) {
        return new UpsertMySchedulePreferenceRequest(expectedRevision, List.of(), comment);
    }

    private SchedulePreferenceCellRequest cellRequest(LocalDate day, SchedulePreferenceType type, String note) {
        return new SchedulePreferenceCellRequest(
                day.toString(), type, true, null, null, note);
    }

    private void assertRevisionConflict(Runnable operation) {
        assertThatThrownBy(operation::run)
                .isInstanceOfSatisfying(ScheduleDomainConflictException.class,
                        error -> assertThat(error.getErrorCode()).isEqualTo("SCHEDULE_PREFERENCE_REVISION_CONFLICT"));
    }
}
