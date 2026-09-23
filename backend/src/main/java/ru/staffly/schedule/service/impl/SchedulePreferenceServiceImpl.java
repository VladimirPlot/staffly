package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.exception.ScheduleDomainConflictException;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.SchedulePreferenceService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeParseException;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class SchedulePreferenceServiceImpl implements SchedulePreferenceService {

    private static final String[] WEEKDAY_LABELS = {"", "пн", "вт", "ср", "чт", "пт", "сб", "вс"};
    private static final int MAX_CELLS_PER_DAY = 8;
    private static final int MAX_PERIOD_COMMENT_LENGTH = 1000;
    private static final int MAX_CELL_NOTE_LENGTH = 500;

    private final ScheduleRepository schedules;
    private final SchedulePreferenceSubmissionRepository submissions;
    private final ScheduleParticipationRepository participations;
    private final RestaurantMemberRepository members;
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final InboxMessageService inboxMessages;
    private final UserRepository users;

    @Override
    @Transactional(readOnly = true)
    public SchedulePreferenceMyResponse getMyPreference(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        Schedule schedule = loadSchedule(restaurantId, scheduleId);
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                && schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED
                && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Пожелания доступны только в режиме сбора или после закрытия сбора");
        }
        ScheduleParticipation participation = loadParticipation(restaurantId, schedule, userId);
        RestaurantMember member = participation.getMember();
        SchedulePreferenceSubmission submission = submissions.findWithCellsByScheduleIdAndMemberId(scheduleId, member.getId()).orElse(null);
        return toMyResponse(schedule, participation, submission);
    }

    @Override
    public SchedulePreferenceMyResponse upsertMyPreference(Long restaurantId, Long scheduleId, Long userId, UpsertMySchedulePreferenceRequest request) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        // The Schedule row is the mutex for the whole preference collection cycle.
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        Instant now = TimeProvider.now();
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES) {
            throw new ScheduleDomainConflictException(
                    "SCHEDULE_PREFERENCE_COLLECTION_CLOSED",
                    "Сбор пожеланий уже закрыт. Обновите график."
            );
        }
        if (schedule.getPreferenceDeadline() == null || !now.isBefore(schedule.getPreferenceDeadline())) {
            throw new BadRequestException("Срок отправки пожеланий истёк");
        }
        ScheduleParticipation participation = loadParticipation(restaurantId, schedule, userId);
        RestaurantMember member = participation.getMember();
        List<SchedulePreferenceCell> cells = buildCells(schedule, participation.getPositionId(), request == null ? null : request.cells());
        String periodComment = normalizeText(request == null ? null : request.periodComment(), MAX_PERIOD_COMMENT_LENGTH, "periodComment");

        SchedulePreferenceSubmission submission = submissions.findForUpdateByScheduleIdAndMemberId(scheduleId, member.getId())
                .orElseGet(() -> SchedulePreferenceSubmission.builder()
                        .schedule(schedule)
                        .member(member)
                        .createdAt(now)
                        .revision(0)
                        .build());

        int currentRevision = submission.getId() == null ? 0 : submission.getRevision();
        if (!Objects.equals(request.expectedRevision(), currentRevision)) {
            throw new ScheduleDomainConflictException(
                    "SCHEDULE_PREFERENCE_REVISION_CONFLICT",
                    "Пожелания были изменены в другой сессии. Обновите данные и повторите изменения."
            );
        }

        if (submission.getId() == null) {
            submission.setRevision(1);
        } else {
            submission.setRevision(submission.getRevision() + 1);
        }
        submission.setUserId(member.getUser() == null ? null : member.getUser().getId());
        submission.setPositionId(participation.getPositionId());
        submission.setPositionName(participation.getPositionName());
        submission.setSubmittedAt(now);
        submission.setUpdatedAt(now);
        submission.setPeriodComment(periodComment);
        mergeCellsByDay(submission, cells);

        SchedulePreferenceSubmission saved = submissions.saveAndFlush(submission);
        notifyOwnerIfAllSubmitted(schedule, now, userId);
        // Preference submissions are children of the locked Schedule aggregate;
        // invalidate Schedule-versioned clients even when this is not the last submission.
        schedule.setUpdatedAt(now);
        schedules.flush();
        return toMyResponse(schedule, participation, saved);
    }

    void mergeCellsByDay(SchedulePreferenceSubmission submission, List<SchedulePreferenceCell> requestedCells) {
        Map<LocalDate, SchedulePreferenceCell> existingByDay = submission.getCells().stream()
                .collect(Collectors.toMap(SchedulePreferenceCell::getDay, Function.identity()));
        Set<LocalDate> requestedDays = requestedCells.stream()
                .map(SchedulePreferenceCell::getDay)
                .collect(Collectors.toSet());

        submission.getCells().removeIf(existing -> !requestedDays.contains(existing.getDay()));
        for (SchedulePreferenceCell requested : requestedCells) {
            SchedulePreferenceCell existing = existingByDay.get(requested.getDay());
            if (existing == null) {
                requested.setSubmission(submission);
                submission.getCells().add(requested);
                continue;
            }
            existing.setType(requested.getType());
            existing.setFullDay(requested.isFullDay());
            existing.setStartTime(requested.getStartTime());
            existing.setEndTime(requested.getEndTime());
            existing.setNote(requested.getNote());
            existing.setSortOrder(requested.getSortOrder());
        }
    }

    private void notifyOwnerIfAllSubmitted(Schedule schedule, Instant now, Long actorUserId) {
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                || schedule.getPreferenceAllSubmittedNotifiedAt() != null) {
            return;
        }
        List<ScheduleParticipation> participants = loadParticipations(schedule);
        int totalParticipants = participants.size();
        if (totalParticipants <= 0) {
            return;
        }
        Set<Long> participantIds = participants.stream().map(value -> value.getMember().getId()).collect(Collectors.toSet());
        long submittedCount = submissions.findByScheduleIdWithMember(schedule.getId()).stream()
                .map(SchedulePreferenceSubmission::getMember)
                .filter(Objects::nonNull)
                .map(RestaurantMember::getId)
                .filter(participantIds::contains)
                .distinct()
                .count();
        if (submittedCount != totalParticipants) {
            return;
        }

        Long ownerUserId = schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId();
        if (ownerUserId == null || Objects.equals(ownerUserId, actorUserId)) {
            schedule.setPreferenceAllSubmittedNotifiedAt(now);
            return;
        }
        RestaurantMember owner = schedule.getOwnerMember();
        if (owner == null || owner.getUser() == null || !Objects.equals(owner.getUser().getId(), ownerUserId)) {
            owner = members.findByUserIdAndRestaurantId(ownerUserId, schedule.getRestaurant().getId()).orElse(null);
        }
        if (owner == null || owner.getUser() == null) {
            schedule.setPreferenceAllSubmittedNotifiedAt(now);
            return;
        }
        User creator = users.findById(actorUserId).orElse(null);
        String content = "Все сотрудники отправили пожелания по графику «" + schedule.getTitle()
                + "» за период " + schedule.getStartDate() + " — " + schedule.getEndDate() + ".";
        inboxMessages.createEvent(
                schedule.getRestaurant(),
                creator,
                content,
                InboxEventSubtype.SCHEDULE_PREFERENCES,
                allSubmittedMeta(schedule),
                List.of(owner),
                null
        );
        schedule.setPreferenceAllSubmittedNotifiedAt(now);
    }

    static String allSubmittedMeta(Schedule schedule) {
        return "schedulePreferences:allSubmitted:restaurant:" + schedule.getRestaurant().getId()
                + ":schedule:" + schedule.getId() + ":cycle:" + schedule.getPreferenceCollectionCycle();
    }


    private List<RestaurantMember> deduplicateMembersByUserId(List<RestaurantMember> source) {
        if (source == null || source.isEmpty()) {
            return List.of();
        }
        Map<Long, RestaurantMember> byUserId = new LinkedHashMap<>();
        for (RestaurantMember member : source) {
            if (member == null || member.getUser() == null || member.getUser().getId() == null) {
                continue;
            }
            byUserId.putIfAbsent(member.getUser().getId(), member);
        }
        return new ArrayList<>(byUserId.values());
    }

    @Override
    @Transactional(readOnly = true)
    public SchedulePreferenceProgressResponse getProgress(Long restaurantId, Long scheduleId, Long actorUserId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        Schedule schedule = loadSchedule(restaurantId, scheduleId);
        List<ScheduleParticipation> participants = loadParticipations(schedule);
        Map<Long, SchedulePreferenceSubmission> byMemberId = submissions.findWithCellsByScheduleId(scheduleId).stream()
                .collect(Collectors.toMap(s -> s.getMember().getId(), Function.identity(), (a, b) -> a));

        List<SchedulePreferenceParticipantDto> participantDtos = participants.stream()
                .sorted(Comparator.comparing(value -> displayName(value.getMember()), Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(participation -> {
                    SchedulePreferenceSubmission submission = byMemberId.get(participation.getMember().getId());
                    return toParticipantDto(participation, submission);
                })
                .toList();
        long submittedCount = participantDtos.stream().filter(SchedulePreferenceParticipantDto::submitted).count();
        return new SchedulePreferenceProgressResponse(
                schedule.getId(),
                schedule.getTitle(),
                schedule.getStatus(),
                schedule.getPreferenceDeadline(),
                participantDtos.size(),
                submittedCount,
                participantDtos.size() - submittedCount,
                participantDtos
        );
    }

    @Override
    @Transactional(readOnly = true)
    public SchedulePreferenceSubmissionsResponse getSubmissions(Long restaurantId, Long scheduleId, Long actorUserId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        Schedule schedule = loadSchedule(restaurantId, scheduleId);
        List<SchedulePreferenceSubmissionDto> submissionDtos = submissions.findWithCellsByScheduleId(scheduleId).stream()
                .sorted(Comparator.comparing(SchedulePreferenceSubmission::getSubmittedAt, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(this::toSubmissionDto)
                .toList();
        return new SchedulePreferenceSubmissionsResponse(
                schedule.getId(),
                schedule.getTitle(),
                schedule.getStatus(),
                schedule.getPreferenceDeadline(),
                submissionDtos
        );
    }

    private Schedule loadSchedule(Long restaurantId, Long scheduleId) {
        return schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
    }

    private ScheduleParticipation loadParticipation(Long restaurantId, Schedule schedule, Long userId) {
        RestaurantMember member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Not a restaurant member"));
        return participations.findByScheduleIdAndMemberId(schedule.getId(), member.getId())
                .orElseThrow(() -> new ForbiddenException("Сотрудник не участвует в этом графике"));
    }


    private List<ScheduleParticipation> loadParticipations(Schedule schedule) {
        return participations.findByScheduleIdOrderById(schedule.getId());
    }

    List<SchedulePreferenceCell> buildCells(Schedule schedule, Long participationPositionId, List<SchedulePreferenceCellRequest> requests) {
        List<SchedulePreferenceCellRequest> safeRequests = requests == null ? List.of() : requests;
        long daysCount = schedule.getStartDate().datesUntil(schedule.getEndDate().plusDays(1)).count();
        int maxCells = Math.toIntExact(daysCount * MAX_CELLS_PER_DAY);
        if (safeRequests.size() > maxCells) {
            throw new BadRequestException("Too many preference cells");
        }
        if (schedule.getPreferenceCollectionMode() == null) {
            throw new BadRequestException("Способ сбора пожеланий не настроен");
        }

        Set<LocalDate> seenDays = new HashSet<>();
        List<SchedulePreferenceCell> cells = new ArrayList<>(safeRequests.size());
        for (int i = 0; i < safeRequests.size(); i++) {
            SchedulePreferenceCellRequest request = safeRequests.get(i);
            if (request == null) throw new BadRequestException("cells[" + i + "] is required");
            LocalDate day = parseDay(request.day(), i);
            if (!seenDays.add(day)) throw new BadRequestException("На один день можно указать только одно пожелание");
            if (day.isBefore(schedule.getStartDate()) || day.isAfter(schedule.getEndDate())) {
                throw new BadRequestException("cells[" + i + "].day must be inside schedule range");
            }
            if (request.type() == null) throw new BadRequestException("cells[" + i + "].type is required");
            if (request.fullDay() == null) throw new BadRequestException("cells[" + i + "].fullDay is required");

            boolean fullDay = request.fullDay();
            LocalTime startTime = null;
            LocalTime endTime = null;
            if (fullDay) {
                if (!isBlank(request.startTime()) || !isBlank(request.endTime())) {
                    throw new BadRequestException("Пожелание на весь день не может содержать время");
                }
            } else {
                if (request.type() != SchedulePreferenceType.AVAILABLE) {
                    throw new BadRequestException("Время можно указать только для пожелания «Могу работать»");
                }
                if (schedule.getPreferenceCollectionMode() != PreferenceCollectionMode.SHIFT_OPTIONS) {
                    throw new BadRequestException("В этом сборе пожеланий нельзя выбирать время");
                }
                startTime = parseTime(request.startTime(), "cells[" + i + "].startTime");
                endTime = parseTime(request.endTime(), "cells[" + i + "].endTime");
                if (startTime.equals(endTime) || !isApplicableSnapshot(schedule, participationPositionId, startTime, endTime)) {
                    throw unavailablePreferenceInterval(startTime, endTime);
                }
            }
            cells.add(SchedulePreferenceCell.builder()
                    .day(day).type(request.type()).fullDay(fullDay)
                    .startTime(startTime).endTime(endTime)
                    .note(normalizeText(request.note(), MAX_CELL_NOTE_LENGTH, "cells[" + i + "].note"))
                    .sortOrder(i).build());
        }
        return cells;
    }

    private boolean isApplicableSnapshot(Schedule schedule, Long positionId,
                                         LocalTime startTime, LocalTime endTime) {
        return positionId != null && schedule.getPreferenceShiftOptionSnapshots().stream()
                .anyMatch(option -> option.getPositionIds().contains(positionId)
                        && option.getStartTime().equals(startTime)
                        && option.getEndTime().equals(endTime));
    }

    private BadRequestException unavailablePreferenceInterval(LocalTime startTime, LocalTime endTime) {
        return new BadRequestException("Выбранный интервал " + startTime + "–" + endTime
                + " недоступен для этого рабочего дня");
    }


    private SchedulePreferenceMyResponse toMyResponse(Schedule schedule, ScheduleParticipation participation, SchedulePreferenceSubmission submission) {
        RestaurantMember member = participation.getMember();
        return new SchedulePreferenceMyResponse(
                schedule.getId(),
                schedule.getTitle(),
                schedule.getStartDate().toString(),
                schedule.getEndDate().toString(),
                collectDays(schedule.getStartDate(), schedule.getEndDate()).stream().map(this::toDayDto).toList(),
                schedule.getStatus(),
                schedule.getPreferenceCollectionMode(),
                schedule.getPreferenceDeadline(),
                canSubmit(schedule),
                submission == null ? null : submission.getSubmittedAt(),
                submission == null ? null : submission.getUpdatedAt(),
                submission == null ? 0 : submission.getRevision(),
                schedule.getPreferenceCollectionCycle(),
                toMemberDto(participation),
                allowedShiftOptions(schedule, participation.getPositionId()),
                submission == null ? List.of() : toCellDtos(submission.getCells()),
                submission == null ? null : submission.getPeriodComment()
        );
    }

    private List<SchedulePreferenceAllowedShiftOptionDto> allowedShiftOptions(Schedule schedule, Long positionId) {
        if (schedule.getPreferenceCollectionMode() != PreferenceCollectionMode.SHIFT_OPTIONS || positionId == null) {
            return List.of();
        }
        return schedule.getPreferenceShiftOptionSnapshots().stream()
                .filter(option -> option.getPositionIds().contains(positionId))
                .sorted(Comparator.comparing(SchedulePreferenceShiftOptionSnapshot::getSortOrder)
                        .thenComparing(SchedulePreferenceShiftOptionSnapshot::getId,
                                Comparator.nullsLast(Long::compareTo)))
                .map(option -> new SchedulePreferenceAllowedShiftOptionDto(
                        option.getSourceShiftOptionId(), option.getLabel(), option.getStartTime(), option.getEndTime()))
                .toList();
    }

    private boolean canSubmit(Schedule schedule) {
        return schedule.getStatus() == ScheduleStatus.COLLECTING_PREFERENCES
                && schedule.getPreferenceDeadline() != null
                && TimeProvider.now().isBefore(schedule.getPreferenceDeadline());
    }

    private SchedulePreferenceParticipantDto toParticipantDto(ScheduleParticipation participation, SchedulePreferenceSubmission submission) {
        RestaurantMember member = participation.getMember();
        return new SchedulePreferenceParticipantDto(
                member.getId(),
                member.getUser() == null ? null : member.getUser().getId(),
                displayName(member),
                participation.getPositionId(),
                participation.getPositionName(),
                submission != null,
                submission == null ? null : submission.getSubmittedAt(),
                submission == null ? null : submission.getUpdatedAt(),
                submission == null ? 0 : submission.getRevision(),
                submission == null ? 0 : submission.getCells().size()
        );
    }

    private SchedulePreferenceSubmissionDto toSubmissionDto(SchedulePreferenceSubmission submission) {
        return new SchedulePreferenceSubmissionDto(
                submission.getId(),
                toMemberDto(submission),
                submission.getPositionId(),
                submission.getPositionName(),
                submission.getSubmittedAt(),
                submission.getUpdatedAt(),
                submission.getRevision(),
                submission.getPeriodComment(),
                toCellDtos(submission.getCells())
        );
    }

    private SchedulePreferenceMemberDto toMemberDto(ScheduleParticipation participation) {
        RestaurantMember member = participation.getMember();
        return new SchedulePreferenceMemberDto(
                member.getId(),
                member.getUser() == null ? null : member.getUser().getId(),
                displayName(member),
                participation.getPositionId(),
                participation.getPositionName()
        );
    }

    private SchedulePreferenceMemberDto toMemberDto(SchedulePreferenceSubmission submission) {
        RestaurantMember member = submission.getMember();
        return new SchedulePreferenceMemberDto(member.getId(),
                member.getUser() == null ? null : member.getUser().getId(), displayName(member),
                submission.getPositionId(), submission.getPositionName());
    }

    private List<SchedulePreferenceCellDto> toCellDtos(List<SchedulePreferenceCell> cells) {
        return cells.stream()
                .sorted(Comparator.comparing(SchedulePreferenceCell::getDay)
                        .thenComparingInt(SchedulePreferenceCell::getSortOrder)
                        .thenComparing(cell -> cell.getId() == null ? Long.MAX_VALUE : cell.getId()))
                .map(cell -> new SchedulePreferenceCellDto(
                        cell.getId(),
                        cell.getDay().toString(),
                        cell.getType(),
                        cell.isFullDay(),
                        cell.getStartTime() == null ? null : cell.getStartTime().toString(),
                        cell.getEndTime() == null ? null : cell.getEndTime().toString(),
                        cell.getNote(),
                        cell.getSortOrder()
                ))
                .toList();
    }

    private String displayName(RestaurantMember member) {
        User user = member.getUser();
        if (user == null) return null;
        String fullName = trimToNull(user.getFullName());
        if (fullName != null) return fullName;
        return trimToNull((Objects.toString(user.getFirstName(), "") + " " + Objects.toString(user.getLastName(), "")).trim());
    }

    private List<LocalDate> collectDays(LocalDate start, LocalDate end) {
        List<LocalDate> result = new ArrayList<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(end)) {
            result.add(cursor);
            cursor = cursor.plusDays(1);
        }
        return result;
    }

    private ScheduleDayDto toDayDto(LocalDate day) {
        int dayOfWeek = day.getDayOfWeek().getValue();
        return new ScheduleDayDto(day.toString(), WEEKDAY_LABELS[dayOfWeek], Integer.toString(day.getDayOfMonth()));
    }

    private LocalDate parseDay(String value, int index) {
        if (isBlank(value)) {
            throw new BadRequestException("cells[" + index + "].day is required");
        }
        try {
            return LocalDate.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("Invalid cells[" + index + "].day format, expected yyyy-MM-dd");
        }
    }

    private LocalTime parseTime(String value, String field) {
        if (isBlank(value)) {
            throw new BadRequestException(field + " is required");
        }
        try {
            return LocalTime.parse(value.trim());
        } catch (DateTimeParseException ex) {
            throw new BadRequestException("Invalid " + field + " format, expected HH:mm");
        }
    }

    private String normalizeText(String value, int maxLength, String fieldName) {
        String normalized = trimToNull(value);
        if (normalized != null && normalized.length() > maxLength) {
            throw new BadRequestException(fieldName + " must be at most " + maxLength + " characters");
        }
        return normalized;
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

}
