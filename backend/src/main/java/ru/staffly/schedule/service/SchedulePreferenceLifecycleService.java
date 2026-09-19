package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.exception.ScheduleVersionConflictException;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.time.Instant;
import java.util.*;

/**
 * Authoritative mutation boundary for an active preference collection.
 * Lock order is Member (ascending id) -> Schedule -> collection children.
 */
@Service
@RequiredArgsConstructor
public class SchedulePreferenceLifecycleService {
    private final RestaurantMemberRepository members;
    private final ScheduleRepository schedules;
    private final ScheduleParticipationRepository participations;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final ScheduleParticipationCreator participationCreator;
    private final ScheduleAuditService auditService;

    @Transactional
    public MutationResult removeParticipant(Long restaurantId, Long scheduleId, Long memberId,
                                            Long expectedVersion, Long actorUserId, String reason) {
        RestaurantMember member = lockMember(restaurantId, memberId);
        Schedule schedule = lockSchedule(restaurantId, scheduleId);
        assertVersion(schedule, expectedVersion);
        assertMutablePreferenceState(schedule);

        boolean hadSubmission = submissions.deleteByScheduleIdAndMemberId(scheduleId, member.getId()) > 0;
        boolean removed = participations.deleteByScheduleIdAndMemberId(scheduleId, member.getId()) > 0;
        if (!removed && !hadSubmission) {
            return new MutationResult(schedule, false);
        }
        // Completion is cycle-scoped and submission-driven. Administrative removal neither
        // reopens an already processed completion nor invokes notification processing.
        touchAndFlush(schedule);
        auditService.record(schedule, actorUserId, ScheduleAuditAction.PREFERENCE_PARTICIPANT_REMOVED,
                details("Участник сбора пожеланий удалён", reason));
        return new MutationResult(schedule, true);
    }

    @Transactional
    public MutationResult addParticipant(Long restaurantId, Long scheduleId, Long memberId,
                                         Long expectedVersion, Long actorUserId, String reason) {
        RestaurantMember member = lockMember(restaurantId, memberId);
        Schedule schedule = lockSchedule(restaurantId, scheduleId);
        assertVersion(schedule, expectedVersion);
        assertMutablePreferenceState(schedule);
        ScheduleParticipationCreator.CreationResult created = addWithLocksHeld(schedule, member);
        if (!created.created()) {
            return new MutationResult(schedule, false);
        }
        schedule.setPreferenceAllSubmittedNotifiedAt(null);
        touchAndFlush(schedule);
        auditService.record(schedule, actorUserId, ScheduleAuditAction.PREFERENCE_PARTICIPANT_ADDED,
                details("Участник добавлен в сбор пожеланий", reason));
        return new MutationResult(schedule, true);
    }

    @Transactional
    public Schedule reopenCollection(Long restaurantId, Long scheduleId, Long expectedVersion,
                                     Instant newDeadline, Collection<Long> newParticipantIds,
                                     Long actorUserId, String reason) {
        Instant now = TimeProvider.now();
        if (newDeadline == null || !newDeadline.isAfter(now)) {
            throw new BadRequestException("preferenceDeadline must be in the future");
        }
        List<Long> ids = newParticipantIds == null ? List.of() : newParticipantIds.stream()
                .filter(Objects::nonNull).distinct().sorted().toList();
        List<RestaurantMember> lockedMembers = ids.isEmpty() ? List.of()
                : members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, ids);
        if (lockedMembers.size() != ids.size()) {
            throw new NotFoundException("One or more participants were not found");
        }
        Schedule schedule = lockSchedule(restaurantId, scheduleId);
        assertVersion(schedule, expectedVersion);
        if (schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED) {
            throw new BadRequestException("Only a closed preference collection can be reopened");
        }
        for (RestaurantMember member : lockedMembers) {
            addWithLocksHeld(schedule, member);
        }
        schedule.setStatus(ScheduleStatus.COLLECTING_PREFERENCES);
        schedule.setPreferenceDeadline(newDeadline);
        schedule.setPreferenceClosedAt(null);
        schedule.setPreferenceAllSubmittedNotifiedAt(null);
        schedule.setPreferenceCollectionCycle(schedule.getPreferenceCollectionCycle() + 1);
        touchAndFlush(schedule);
        auditService.record(schedule, actorUserId, ScheduleAuditAction.PREFERENCE_COLLECTION_REOPENED,
                details("Сбор пожеланий открыт повторно", reason));
        return schedule;
    }

    @Transactional
    public Schedule invalidatePreferenceCollection(Long restaurantId, Long scheduleId, Long expectedVersion,
                                                   Long actorUserId, String reason) {
        Schedule schedule = lockSchedule(restaurantId, scheduleId);
        assertVersion(schedule, expectedVersion);
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                && schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED
                && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Schedule has no preference collection that can be invalidated");
        }
        submissions.deleteByScheduleId(scheduleId);
        participations.deleteByScheduleId(scheduleId);
        schedule.getPreferenceShiftOptionSnapshots().clear();
        if (schedule.getStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            // Provenance is cell-level: preserve MANUAL/PREFERENCE_HINT cells, remove only AUTO_BUILD output.
            schedule.getRows().forEach(row -> row.getCells()
                    .removeIf(cell -> cell.getSource() == ScheduleCellSource.AUTO_BUILD));
        }
        schedule.setPreferenceBuildTemplate(null);
        schedule.setPreferenceCollectionMode(null);
        schedule.setPreferenceCollectionStartedAt(null);
        schedule.setPreferenceDeadline(null);
        schedule.setPreferenceClosedAt(null);
        schedule.setPreferenceAllSubmittedNotifiedAt(null);
        schedule.setPreferenceAppliedAt(null);
        schedule.setStatus(ScheduleStatus.DRAFT);
        touchAndFlush(schedule);
        auditService.record(schedule, actorUserId, ScheduleAuditAction.PREFERENCE_COLLECTION_INVALIDATED,
                details("Сбор пожеланий аннулирован", reason));
        return schedule;
    }

    private ScheduleParticipationCreator.CreationResult addWithLocksHeld(Schedule schedule, RestaurantMember member) {
        Optional<ScheduleParticipation> existing =
                participations.findByScheduleIdAndMemberId(schedule.getId(), member.getId());
        if (existing.isPresent()) {
            return new ScheduleParticipationCreator.CreationResult(existing.get(), false);
        }
        participationCreator.validateEligibility(schedule, member, true);
        if (schedule.getPreferenceCollectionMode() == PreferenceCollectionMode.SHIFT_OPTIONS) {
            boolean vocabularyExists = schedule.getPreferenceShiftOptionSnapshots().stream()
                    .anyMatch(snapshot -> snapshot.getPositionIds().contains(member.getPosition().getId()));
            if (!vocabularyExists) {
                throw new BadRequestException("No frozen Shift Option vocabulary exists for participant position");
            }
        }
        return participationCreator.createWithLocksHeld(schedule, member, true);
    }

    private RestaurantMember lockMember(Long restaurantId, Long memberId) {
        return members.findForUpdateByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
    }

    private Schedule lockSchedule(Long restaurantId, Long scheduleId) {
        return schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
    }

    private void assertVersion(Schedule schedule, Long expectedVersion) {
        if (expectedVersion == null || !Objects.equals(schedule.getVersion(), expectedVersion)) {
            throw new ScheduleVersionConflictException(expectedVersion, schedule.getVersion());
        }
    }

    private void assertMutablePreferenceState(Schedule schedule) {
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                && schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED) {
            throw new BadRequestException("Participants can only change in an active or closed preference collection");
        }
    }

    private void touchAndFlush(Schedule schedule) {
        schedule.setUpdatedAt(TimeProvider.now());
        schedules.saveAndFlush(schedule);
    }

    private String details(String action, String reason) {
        return reason == null || reason.isBlank() ? action : action + ": " + reason.trim();
    }

    public record MutationResult(Schedule schedule, boolean changed) {}
}
