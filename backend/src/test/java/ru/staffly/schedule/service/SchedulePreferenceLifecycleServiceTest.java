package ru.staffly.schedule.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.exception.ScheduleVersionConflictException;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchedulePreferenceLifecycleServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock ScheduleRepository schedules;
    @Mock ScheduleParticipationRepository participations;
    @Mock SchedulePreferenceSubmissionRepository submissions;
    @Mock ScheduleParticipationCreator creator;
    @Mock ScheduleAuditService audit;

    SchedulePreferenceLifecycleService service;
    Restaurant restaurant;
    Position position;
    RestaurantMember member;
    Schedule schedule;

    @BeforeEach
    void setUp() {
        service = new SchedulePreferenceLifecycleService(members, schedules, participations, submissions, creator, audit);
        restaurant = Restaurant.builder().id(10L).build();
        position = Position.builder().id(20L).name("Cook").restaurant(restaurant).build();
        member = RestaurantMember.builder().id(30L).restaurant(restaurant).position(position).build();
        schedule = Schedule.builder().id(40L).version(7L).restaurant(restaurant)
                .status(ScheduleStatus.COLLECTING_PREFERENCES)
                .positions(new LinkedHashSet<>(List.of(position))).rows(new ArrayList<>())
                .preferenceShiftOptionSnapshots(new ArrayList<>()).preferenceCollectionCycle(1).build();
        when(schedules.findForUpdateByIdAndRestaurantId(40L, 10L)).thenReturn(Optional.of(schedule));
    }

    @Test
    void removeDeletesOnlyMembersSubmissionAndParticipationWithoutTouchingSnapshotsOrNotifying() {
        Instant completionProcessedAt = Instant.parse("2026-01-03T00:00:00Z");
        schedule.setPreferenceAllSubmittedNotifiedAt(completionProcessedAt);
        SchedulePreferenceShiftOptionSnapshot snapshot = SchedulePreferenceShiftOptionSnapshot.builder()
                .positionIds(new LinkedHashSet<>(List.of(20L))).build();
        schedule.getPreferenceShiftOptionSnapshots().add(snapshot);
        when(members.findForUpdateByIdAndRestaurantId(30L, 10L)).thenReturn(Optional.of(member));
        when(submissions.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(1L);
        when(participations.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(1L);

        var result = service.removeParticipant(10L, 40L, 30L, 7L, 50L, "position change");

        assertThat(result.changed()).isTrue();
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).containsExactly(snapshot);
        assertThat(schedule.getPreferenceAllSubmittedNotifiedAt()).isEqualTo(completionProcessedAt);
        verify(submissions).deleteByScheduleIdAndMemberId(40L, 30L);
        verify(participations).deleteByScheduleIdAndMemberId(40L, 30L);
        verify(audit).record(schedule, 50L, ScheduleAuditAction.PREFERENCE_PARTICIPANT_REMOVED,
                "Участник сбора пожеланий удалён: position change");
    }

    @Test
    void addClearsProcessedCompletionMarker() {
        schedule.setPreferenceAllSubmittedNotifiedAt(Instant.parse("2026-01-03T00:00:00Z"));
        when(members.findForUpdateByIdAndRestaurantId(30L, 10L)).thenReturn(Optional.of(member));
        when(participations.findByScheduleIdAndMemberId(40L, 30L)).thenReturn(Optional.empty());
        ScheduleParticipation participation = ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(20L).positionName("Cook").build();
        when(creator.createWithLocksHeld(schedule, member, true))
                .thenReturn(new ScheduleParticipationCreator.CreationResult(participation, true));

        service.addParticipant(10L, 40L, 30L, 7L, 50L, null);

        assertThat(schedule.getPreferenceAllSubmittedNotifiedAt()).isNull();
        verify(creator).validateEligibility(schedule, member, true);
    }

    @Test
    void shiftOptionsWithoutFrozenVocabularyIsRejectedBeforePersistence() {
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        when(members.findForUpdateByIdAndRestaurantId(30L, 10L)).thenReturn(Optional.of(member));
        when(participations.findByScheduleIdAndMemberId(40L, 30L)).thenReturn(Optional.empty());

        assertThatThrownBy(() -> service.addParticipant(10L, 40L, 30L, 7L, 50L, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("No frozen Shift Option vocabulary exists for participant position");

        verify(creator).validateEligibility(schedule, member, true);
        verify(creator, never()).createWithLocksHeld(any(), any(), anyBoolean());
        verify(participations, never()).save(any());
        verify(participations, never()).delete(any());
    }

    @Test
    void absentParticipantAndSubmissionIsIdempotentAndDoesNotAdvanceAggregate() {
        when(members.findForUpdateByIdAndRestaurantId(30L, 10L)).thenReturn(Optional.of(member));

        var result = service.removeParticipant(10L, 40L, 30L, 7L, 50L, null);

        assertThat(result.changed()).isFalse();
        verify(schedules, never()).saveAndFlush(any());
        verifyNoInteractions(audit);
    }

    @Test
    void removedOldSubmissionThenReAddProducesActualNewParticipation() {
        when(submissions.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(1L);
        when(participations.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(0L);
        when(participations.findByScheduleIdAndMemberId(40L, 30L)).thenReturn(Optional.empty());
        ScheduleParticipation replacement = ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(20L).positionName("Cook").build();
        when(creator.createWithLocksHeld(schedule, member, true))
                .thenReturn(new ScheduleParticipationCreator.CreationResult(replacement, true));

        var removal = service.removeParticipantWithLocksHeld(
                schedule, member, 50L, "position change");
        boolean created = service.addParticipantWithLocksHeld(
                schedule, member, 50L, "position change");

        assertThat(removal.submissionRemoved()).isTrue();
        assertThat(removal.participationRemoved()).isFalse();
        assertThat(removal.changed()).isTrue();
        assertThat(created).isTrue();
        verify(participations).deleteByScheduleIdAndMemberId(40L, 30L);
        verify(creator).createWithLocksHeld(schedule, member, true);
        verify(audit).record(schedule, 50L, ScheduleAuditAction.PREFERENCE_PARTICIPANT_REMOVED,
                "Участник сбора пожеланий удалён: position change");
    }

    @Test
    void lockedRemovalReportsParticipationAndSubmissionWhenBothDeletesSucceed() {
        when(submissions.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(1L);
        when(participations.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(1L);

        var result = service.removeParticipantWithLocksHeld(schedule, member, 50L, "position change");

        assertThat(result.participationRemoved()).isTrue();
        assertThat(result.submissionRemoved()).isTrue();
        assertThat(result.changed()).isTrue();
        verify(audit, times(1)).record(schedule, 50L, ScheduleAuditAction.PREFERENCE_PARTICIPANT_REMOVED,
                "Участник сбора пожеланий удалён: position change");
    }

    @Test
    void lockedRemovalReportsOnlyParticipationWhenOnlyParticipationDeleteSucceeds() {
        when(participations.deleteByScheduleIdAndMemberId(40L, 30L)).thenReturn(1L);

        var result = service.removeParticipantWithLocksHeld(schedule, member, 50L, "position change");

        assertThat(result.participationRemoved()).isTrue();
        assertThat(result.submissionRemoved()).isFalse();
        assertThat(result.changed()).isTrue();
        verify(audit, times(1)).record(schedule, 50L, ScheduleAuditAction.PREFERENCE_PARTICIPANT_REMOVED,
                "Участник сбора пожеланий удалён: position change");
    }

    @Test
    void lockedRemovalReportsNoChangeAndDoesNotAuditWhenNeitherDeleteSucceeds() {
        var result = service.removeParticipantWithLocksHeld(schedule, member, 50L, "position change");

        assertThat(result.participationRemoved()).isFalse();
        assertThat(result.submissionRemoved()).isFalse();
        assertThat(result.changed()).isFalse();
        verifyNoInteractions(audit);
    }

    @Test
    void reopenPreservesCollectionDataAndOriginalStartButStartsNewNotificationCycle() {
        Instant started = Instant.parse("2026-01-01T00:00:00Z");
        Instant closed = Instant.parse("2026-01-02T00:00:00Z");
        Instant deadline = Instant.now().plusSeconds(3600);
        schedule.setStatus(ScheduleStatus.PREFERENCES_CLOSED);
        schedule.setPreferenceCollectionStartedAt(started);
        schedule.setPreferenceClosedAt(closed);
        schedule.setPreferenceAllSubmittedNotifiedAt(closed);
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL);

        service.reopenCollection(10L, 40L, 7L, deadline, List.of(), 50L, null);

        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.COLLECTING_PREFERENCES);
        assertThat(schedule.getPreferenceCollectionStartedAt()).isEqualTo(started);
        assertThat(schedule.getPreferenceClosedAt()).isNull();
        assertThat(schedule.getPreferenceDeadline()).isEqualTo(deadline);
        assertThat(schedule.getPreferenceCollectionMode()).isEqualTo(PreferenceCollectionMode.DAY_LEVEL);
        assertThat(schedule.getPreferenceCollectionCycle()).isEqualTo(2);
        verifyNoInteractions(submissions, participations);
    }

    @Test
    void reopenCanAtomicallyAddMemberUsingExistingShiftVocabulary() {
        Instant deadline = Instant.now().plusSeconds(3600);
        schedule.setStatus(ScheduleStatus.PREFERENCES_CLOSED);
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        SchedulePreferenceShiftOptionSnapshot snapshot = SchedulePreferenceShiftOptionSnapshot.builder()
                .positionIds(new LinkedHashSet<>(List.of(20L))).build();
        schedule.getPreferenceShiftOptionSnapshots().add(snapshot);
        when(members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(10L, List.of(30L))).thenReturn(List.of(member));
        ScheduleParticipation participation = ScheduleParticipation.builder().schedule(schedule).member(member)
                .positionId(20L).positionName("Cook").build();
        when(creator.createWithLocksHeld(schedule, member, true))
                .thenReturn(new ScheduleParticipationCreator.CreationResult(participation, true));

        service.reopenCollection(10L, 40L, 7L, deadline, List.of(30L), 50L, null);

        verify(creator).createWithLocksHeld(schedule, member, true);
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).containsExactly(snapshot);
        verifyNoInteractions(submissions);
    }

    @Test
    void lockedReopenReportsActualParticipantCreationAndAppliedResultInvalidation() {
        Instant deadline = Instant.now().plusSeconds(3600);
        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        schedule.setPreferenceAppliedAt(Instant.parse("2026-01-03T00:00:00Z"));
        ScheduleRow row = ScheduleRow.builder().schedule(schedule).cells(new ArrayList<>()).build();
        row.getCells().add(cell(row, ScheduleCellSource.AUTO_BUILD));
        row.getCells().add(cell(row, ScheduleCellSource.MANUAL));
        schedule.getRows().add(row);
        when(participations.findByScheduleIdAndMemberId(40L, 30L)).thenReturn(Optional.empty());
        when(creator.createWithLocksHeld(schedule, member, true)).thenReturn(
                new ScheduleParticipationCreator.CreationResult(
                        ScheduleParticipation.builder().schedule(schedule).member(member).build(), true));

        var result = service.reopenWithLocksHeld(schedule, member, deadline, 50L, "position change");

        assertThat(result.participantCreated()).isTrue();
        assertThat(result.appliedResultInvalidated()).isTrue();
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.COLLECTING_PREFERENCES);
        assertThat(schedule.getPreferenceAppliedAt()).isNull();
        assertThat(row.getCells()).extracting(ScheduleCell::getSource).containsExactly(ScheduleCellSource.MANUAL);
    }

    @Test
    void lockedReopenDoesNotReportEffectsThatDidNotOccur() {
        Instant deadline = Instant.now().plusSeconds(3600);
        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        ScheduleParticipation existing = ScheduleParticipation.builder().schedule(schedule).member(member).build();
        when(participations.findByScheduleIdAndMemberId(40L, 30L)).thenReturn(Optional.of(existing));

        var result = service.reopenWithLocksHeld(schedule, member, deadline, 50L, "position change");

        assertThat(result.participantCreated()).isFalse();
        assertThat(result.appliedResultInvalidated()).isFalse();
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.COLLECTING_PREFERENCES);
        verify(creator, never()).createWithLocksHeld(any(), any(), anyBoolean());
    }

    @Test
    void rejectedLockedReopenDoesNotMutateSchedule() {
        schedule.setStatus(ScheduleStatus.DRAFT);

        assertThatThrownBy(() -> service.reopenWithLocksHeld(
                schedule, member, Instant.now().plusSeconds(3600), 50L, "position change"))
                .isInstanceOf(BadRequestException.class);

        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.DRAFT);
        verifyNoInteractions(participations, creator, audit);
    }

    @Test
    void invitationReopenAdvancesNotificationCycleButPreservesAuthoritativePreferenceInput() {
        Instant deadline = Instant.now().plusSeconds(3600);
        SchedulePreferenceShiftOptionSnapshot snapshot = SchedulePreferenceShiftOptionSnapshot.builder()
                .id(70L).positionIds(new LinkedHashSet<>(List.of(20L))).build();
        schedule.setStatus(ScheduleStatus.PREFERENCES_CLOSED);
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        schedule.setPreferenceCollectionStartedAt(Instant.parse("2026-01-01T00:00:00Z"));
        schedule.setPreferenceClosedAt(Instant.parse("2026-01-02T00:00:00Z"));
        schedule.setPreferenceAllSubmittedNotifiedAt(Instant.parse("2026-01-02T00:00:00Z"));
        schedule.getPreferenceShiftOptionSnapshots().add(snapshot);

        service.prepareInvitationWithLocksHeld(schedule, false, deadline, 50L, "invitation");

        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.COLLECTING_PREFERENCES);
        assertThat(schedule.getPreferenceCollectionCycle()).isEqualTo(2);
        assertThat(schedule.getPreferenceCollectionStartedAt()).isEqualTo(Instant.parse("2026-01-01T00:00:00Z"));
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).containsExactly(snapshot);
        assertThat(schedule.getPreferenceAllSubmittedNotifiedAt()).isNull();
        verifyNoInteractions(submissions, participations, creator);
    }

    @Test
    void invitationRebuildReopenRemovesOnlyGeneratedResultAndPreservesPreferenceInput() {
        Instant deadline = Instant.now().plusSeconds(3600);
        SchedulePreferenceShiftOptionSnapshot snapshot = SchedulePreferenceShiftOptionSnapshot.builder().id(70L).build();
        ScheduleRow row = ScheduleRow.builder().schedule(schedule).cells(new ArrayList<>()).build();
        row.getCells().add(cell(row, ScheduleCellSource.AUTO_BUILD));
        row.getCells().add(cell(row, ScheduleCellSource.MANUAL));
        row.getCells().add(cell(row, ScheduleCellSource.PREFERENCE_HINT));
        schedule.getRows().add(row);
        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        schedule.setPreferenceCollectionStartedAt(Instant.parse("2026-01-01T00:00:00Z"));
        schedule.setPreferenceAppliedAt(Instant.parse("2026-01-03T00:00:00Z"));
        schedule.getPreferenceShiftOptionSnapshots().add(snapshot);

        service.prepareInvitationWithLocksHeld(schedule, true, deadline, 50L, "invitation rebuild");

        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.COLLECTING_PREFERENCES);
        assertThat(schedule.getPreferenceAppliedAt()).isNull();
        assertThat(schedule.getPreferenceCollectionCycle()).isEqualTo(2);
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).containsExactly(snapshot);
        assertThat(row.getCells()).extracting(ScheduleCell::getSource)
                .containsExactly(ScheduleCellSource.MANUAL, ScheduleCellSource.PREFERENCE_HINT);
        verifyNoInteractions(submissions, participations, creator);
    }

    @Test
    void invalidationClearsPreferenceStateAndOnlyAutoBuildCells() {
        ScheduleRow row = ScheduleRow.builder().schedule(schedule).memberId(30L).cells(new ArrayList<>()).build();
        row.getCells().add(cell(row, ScheduleCellSource.AUTO_BUILD));
        row.getCells().add(cell(row, ScheduleCellSource.MANUAL));
        row.getCells().add(cell(row, ScheduleCellSource.PREFERENCE_HINT));
        schedule.getRows().add(row);
        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        schedule.setPreferenceCollectionStartedAt(Instant.now());
        schedule.setPreferenceAppliedAt(Instant.now());
        schedule.getPreferenceShiftOptionSnapshots().add(SchedulePreferenceShiftOptionSnapshot.builder().build());

        service.invalidatePreferenceCollection(10L, 40L, 7L, 50L, "template changed");

        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.DRAFT);
        assertThat(schedule.getPreferenceCollectionMode()).isNull();
        assertThat(schedule.getPreferenceCollectionStartedAt()).isNull();
        assertThat(schedule.getPreferenceAppliedAt()).isNull();
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).isEmpty();
        assertThat(row.getCells()).extracting(ScheduleCell::getSource)
                .containsExactly(ScheduleCellSource.MANUAL, ScheduleCellSource.PREFERENCE_HINT);
        verify(submissions).deleteByScheduleId(40L);
        verify(participations).deleteByScheduleId(40L);
    }

    @Test
    void appliedResultInvalidationPreservesCollectionInputsAndReturnsToClosedState() {
        Instant started = Instant.parse("2026-01-01T00:00:00Z");
        Instant closed = Instant.parse("2026-01-02T00:00:00Z");
        Instant applied = Instant.parse("2026-01-03T00:00:00Z");
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder().id(60L).build();
        SchedulePreferenceShiftOptionSnapshot snapshot = SchedulePreferenceShiftOptionSnapshot.builder().id(70L).build();
        ScheduleRow row = ScheduleRow.builder().schedule(schedule).memberId(30L).cells(new ArrayList<>()).build();
        row.getCells().add(cell(row, ScheduleCellSource.AUTO_BUILD));
        row.getCells().add(cell(row, ScheduleCellSource.MANUAL));
        schedule.getRows().add(row);
        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        schedule.setPreferenceBuildTemplate(template);
        schedule.setPreferenceCollectionStartedAt(started);
        schedule.setPreferenceClosedAt(closed);
        schedule.setPreferenceAppliedAt(applied);
        schedule.setPreferenceCollectionCycle(4);
        schedule.getPreferenceShiftOptionSnapshots().add(snapshot);

        boolean invalidated = service.invalidateAppliedPreferenceDraftWithLocksHeld(schedule, 50L, "position change");

        assertThat(invalidated).isTrue();
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.PREFERENCES_CLOSED);
        assertThat(schedule.getPreferenceAppliedAt()).isNull();
        assertThat(schedule.getPreferenceCollectionMode()).isEqualTo(PreferenceCollectionMode.SHIFT_OPTIONS);
        assertThat(schedule.getPreferenceBuildTemplate()).isSameAs(template);
        assertThat(schedule.getPreferenceCollectionStartedAt()).isEqualTo(started);
        assertThat(schedule.getPreferenceClosedAt()).isEqualTo(closed);
        assertThat(schedule.getPreferenceCollectionCycle()).isEqualTo(4);
        assertThat(schedule.getPreferenceShiftOptionSnapshots()).containsExactly(snapshot);
        assertThat(row.getCells()).extracting(ScheduleCell::getSource).containsExactly(ScheduleCellSource.MANUAL);
        verifyNoInteractions(submissions, participations);
        verify(audit).record(schedule, 50L, ScheduleAuditAction.APPLIED_PREFERENCE_DRAFT_INVALIDATED,
                "Применённый результат пожеланий аннулирован: position change");
    }

    @Test
    void appliedDraftTransitionDoesNotClaimInvalidationWithoutAppliedMarkerOrGeneratedCells() {
        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);

        boolean invalidated = service.invalidateAppliedPreferenceDraftWithLocksHeld(
                schedule, 50L, "position change");

        assertThat(invalidated).isFalse();
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.PREFERENCES_CLOSED);
    }

    @Test
    void publishedInvalidationAndStaleVersionAreRejectedBeforeCleanup() {
        schedule.setStatus(ScheduleStatus.PUBLISHED);
        assertThatThrownBy(() -> service.invalidatePreferenceCollection(10L, 40L, 7L, 50L, null))
                .isInstanceOf(BadRequestException.class);
        schedule.setStatus(ScheduleStatus.COLLECTING_PREFERENCES);
        assertThatThrownBy(() -> service.invalidatePreferenceCollection(10L, 40L, 6L, 50L, null))
                .isInstanceOf(ScheduleVersionConflictException.class);
        verifyNoInteractions(submissions, participations, audit);
    }

    private ScheduleCell cell(ScheduleRow row, ScheduleCellSource source) {
        return ScheduleCell.builder().row(row).day(LocalDate.of(2026, 1, 1)).value("10:00-18:00")
                .source(source).build();
    }
}
