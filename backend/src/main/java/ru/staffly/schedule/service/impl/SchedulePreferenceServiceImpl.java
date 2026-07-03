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
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
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
    private static final LocalTime END_OF_DAY_TIME = LocalTime.MIDNIGHT;

    private final ScheduleRepository schedules;
    private final SchedulePreferenceSubmissionRepository submissions;
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
        RestaurantMember member = loadEligibleMember(restaurantId, schedule, userId);
        SchedulePreferenceSubmission submission = submissions.findWithCellsByScheduleIdAndMemberId(scheduleId, member.getId()).orElse(null);
        return toMyResponse(schedule, member, submission);
    }

    @Override
    public SchedulePreferenceMyResponse upsertMyPreference(Long restaurantId, Long scheduleId, Long userId, UpsertMySchedulePreferenceRequest request) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        Schedule schedule = loadSchedule(restaurantId, scheduleId);
        Instant now = TimeProvider.now();
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES) {
            throw new BadRequestException("Отправить пожелания можно только во время сбора пожеланий");
        }
        if (schedule.getPreferenceDeadline() == null || !now.isBefore(schedule.getPreferenceDeadline())) {
            throw new BadRequestException("Срок отправки пожеланий истёк");
        }
        RestaurantMember member = loadEligibleMember(restaurantId, schedule, userId);
        List<SchedulePreferenceCell> cells = buildCells(schedule, member, request == null ? null : request.cells());
        String comment = normalizeText(request == null ? null : firstNonBlank(request.periodComment(), request.comment()), MAX_PERIOD_COMMENT_LENGTH, "periodComment");

        SchedulePreferenceSubmission submission = submissions.findForUpdateByScheduleIdAndMemberId(scheduleId, member.getId())
                .orElseGet(() -> SchedulePreferenceSubmission.builder()
                        .schedule(schedule)
                        .member(member)
                        .createdAt(now)
                        .revision(0)
                        .build());

        if (submission.getId() == null) {
            submission.setRevision(1);
        } else {
            submission.setRevision(submission.getRevision() + 1);
        }
        submission.setUserId(member.getUser() == null ? null : member.getUser().getId());
        submission.setPositionId(member.getPosition() == null ? null : member.getPosition().getId());
        submission.setPositionName(member.getPosition() == null ? null : member.getPosition().getName());
        submission.setSubmittedAt(now);
        submission.setUpdatedAt(now);
        submission.setPeriodComment(comment);
        submission.getCells().clear();
        for (SchedulePreferenceCell cell : cells) {
            cell.setSubmission(submission);
            submission.getCells().add(cell);
        }

        SchedulePreferenceSubmission saved = submissions.save(submission);
        notifyManagersIfAllSubmitted(schedule, now);
        return toMyResponse(schedule, member, saved);
    }

    private void notifyManagersIfAllSubmitted(Schedule schedule, Instant now) {
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                || schedule.getPreferenceAllSubmittedNotifiedAt() != null) {
            return;
        }
        List<RestaurantMember> participants = loadParticipants(schedule.getRestaurant().getId(), schedule);
        int totalParticipants = participants.size();
        if (totalParticipants <= 0) {
            return;
        }
        Set<Long> participantIds = participants.stream().map(RestaurantMember::getId).collect(Collectors.toSet());
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

        LinkedHashSet<Long> managerUserIds = new LinkedHashSet<>();
        if (schedule.getOwnerUser() != null && schedule.getOwnerUser().getId() != null) {
            managerUserIds.add(schedule.getOwnerUser().getId());
        }
        if (schedule.getCreatedByUser() != null && schedule.getCreatedByUser().getId() != null) {
            managerUserIds.add(schedule.getCreatedByUser().getId());
        }
        if (managerUserIds.isEmpty()) {
            schedule.setPreferenceAllSubmittedNotifiedAt(now);
            return;
        }
        List<RestaurantMember> managerTargets = deduplicateMembersByUserId(
                members.findByRestaurantIdAndUserIdIn(schedule.getRestaurant().getId(), managerUserIds)
        );
        if (managerTargets.isEmpty()) {
            schedule.setPreferenceAllSubmittedNotifiedAt(now);
            return;
        }
        User creator = users.findById(managerUserIds.iterator().next()).orElse(null);
        String content = "Все сотрудники отправили пожелания по графику «" + schedule.getTitle()
                + "» за период " + schedule.getStartDate() + " — " + schedule.getEndDate() + ".";
        inboxMessages.createEvent(
                schedule.getRestaurant(),
                creator,
                content,
                InboxEventSubtype.SCHEDULE_PREFERENCES,
                "schedulePreferences:allSubmitted:restaurant:" + schedule.getRestaurant().getId() + ":schedule:" + schedule.getId(),
                managerTargets,
                schedule.getEndDate()
        );
        schedule.setPreferenceAllSubmittedNotifiedAt(now);
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
        List<RestaurantMember> participants = loadParticipants(restaurantId, schedule);
        Map<Long, SchedulePreferenceSubmission> byMemberId = submissions.findWithCellsByScheduleId(scheduleId).stream()
                .collect(Collectors.toMap(s -> s.getMember().getId(), Function.identity(), (a, b) -> a));

        List<SchedulePreferenceParticipantDto> participantDtos = participants.stream()
                .sorted(Comparator.comparing(this::displayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .map(member -> {
                    SchedulePreferenceSubmission submission = byMemberId.get(member.getId());
                    return toParticipantDto(member, submission);
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

    private RestaurantMember loadEligibleMember(Long restaurantId, Schedule schedule, Long userId) {
        RestaurantMember member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Not a restaurant member"));
        if (schedule.getPositionIds() == null
                || member.getPosition() == null
                || !schedule.getPositionIds().contains(member.getPosition().getId())) {
            throw new ForbiddenException("Должность сотрудника не входит в позиции графика");
        }
        return member;
    }


    private List<RestaurantMember> loadParticipants(Long restaurantId, Schedule schedule) {
        if (schedule.getPositionIds() == null || schedule.getPositionIds().isEmpty()) {
            return List.of();
        }
        return members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(restaurantId, schedule.getPositionIds());
    }

    private List<SchedulePreferenceCell> buildCells(Schedule schedule, RestaurantMember member, List<SchedulePreferenceCellRequest> requests) {
        List<SchedulePreferenceCellRequest> safeRequests = requests == null ? List.of() : requests;
        long daysCount = schedule.getStartDate().datesUntil(schedule.getEndDate().plusDays(1)).count();
        int maxCells = Math.toIntExact(daysCount * MAX_CELLS_PER_DAY);
        if (safeRequests.size() > maxCells) {
            throw new BadRequestException("Too many preference cells");
        }

        Set<CellKey> seen = new HashSet<>();
        List<SchedulePreferenceCell> cells = new ArrayList<>(safeRequests.size());
        for (int i = 0; i < safeRequests.size(); i++) {
            SchedulePreferenceCellRequest request = safeRequests.get(i);
            if (request == null) {
                throw new BadRequestException("cells[" + i + "] is required");
            }
            LocalDate day = parseDay(request.day(), i);
            if (day.isBefore(schedule.getStartDate()) || day.isAfter(schedule.getEndDate())) {
                throw new BadRequestException("cells[" + i + "].day must be inside schedule range");
            }
            if (request.type() == null) {
                throw new BadRequestException("cells[" + i + "].type is required");
            }
            if (request.fullDay() == null) {
                throw new BadRequestException("cells[" + i + "].fullDay is required");
            }
            boolean fullDay = request.fullDay();
            LocalTime startTime = null;
            LocalTime endTime = null;
            if (fullDay) {
                if (!isBlank(request.startTime()) || !isBlank(request.endTime())) {
                    throw new BadRequestException("Full-day preference cannot have startTime or endTime");
                }
            } else {
                startTime = parseTime(request.startTime(), "cells[" + i + "].startTime");
                endTime = parseTime(request.endTime(), "cells[" + i + "].endTime");
                if (!isValidPreferenceInterval(startTime, endTime)) {
                    throw new BadRequestException("cells[" + i + "].startTime must be before endTime");
                }
                if (!isAllowedShiftOption(schedule, member, startTime, endTime)) {
                    throw new BadRequestException("cells[" + i + "] interval is not available for member position");
                }
            }
            CellKey key = new CellKey(day, request.type(), fullDay, startTime, endTime);
            if (!seen.add(key)) {
                throw new BadRequestException("Duplicate preference cell");
            }
            cells.add(SchedulePreferenceCell.builder()
                    .day(day)
                    .type(request.type())
                    .fullDay(fullDay)
                    .startTime(startTime)
                    .endTime(endTime)
                    .note(normalizeText(request.note(), MAX_CELL_NOTE_LENGTH, "cells[" + i + "].note"))
                    .sortOrder(i)
                    .build());
        }
        return cells;
    }

    private boolean isAllowedShiftOption(Schedule schedule,
                                         RestaurantMember member,
                                         LocalTime startTime,
                                         LocalTime endTime) {
        ScheduleBuildTemplate template = schedule.getPreferenceBuildTemplate();
        if (template == null) {
            return true;
        }
        Long positionId = member.getPosition() == null ? null : member.getPosition().getId();
        if (positionId == null) {
            return false;
        }
        return template.getPositionConfigs().stream()
                .filter(config -> config.getPosition() != null && positionId.equals(config.getPosition().getId()))
                .findFirst()
                .map(config -> config.getShiftOptions().stream()
                        .anyMatch(option -> Objects.equals(option.getStartTime(), startTime)
                                && Objects.equals(option.getEndTime(), endTime)))
                .orElse(false);
    }

    private SchedulePreferenceMyResponse toMyResponse(Schedule schedule, RestaurantMember member, SchedulePreferenceSubmission submission) {
        return new SchedulePreferenceMyResponse(
                schedule.getId(),
                schedule.getTitle(),
                schedule.getStartDate().toString(),
                schedule.getEndDate().toString(),
                collectDays(schedule.getStartDate(), schedule.getEndDate()).stream().map(this::toDayDto).toList(),
                schedule.getStatus(),
                schedule.getPreferenceDeadline(),
                canSubmit(schedule),
                submission == null ? null : submission.getSubmittedAt(),
                submission == null ? null : submission.getUpdatedAt(),
                submission == null ? 0 : submission.getRevision(),
                toMemberDto(member),
                allowedShiftOptions(schedule, member),
                submission == null ? List.of() : toCellDtos(submission.getCells()),
                submission == null ? null : submission.getPeriodComment(),
                submission == null ? null : submission.getPeriodComment()
        );
    }

    private List<SchedulePreferenceAllowedShiftOptionDto> allowedShiftOptions(Schedule schedule, RestaurantMember member) {
        ScheduleBuildTemplate template = schedule.getPreferenceBuildTemplate();
        Long positionId = member.getPosition() == null ? null : member.getPosition().getId();
        if (template == null || positionId == null) {
            return List.of();
        }
        return template.getPositionConfigs().stream()
                .filter(config -> config.getPosition() != null && positionId.equals(config.getPosition().getId()))
                .findFirst()
                .map(config -> config.getShiftOptions().stream()
                        .sorted(Comparator.comparing(
                                        ScheduleBuildShiftOption::getSortOrder,
                                        Comparator.nullsLast(Integer::compareTo)
                                )
                                .thenComparing(option -> option.getId() == null ? Long.MAX_VALUE : option.getId()))
                        .map(option -> new SchedulePreferenceAllowedShiftOptionDto(
                                option.getId(),
                                option.getLabel(),
                                option.getStartTime(),
                                option.getEndTime()
                        ))
                        .toList())
                .orElseGet(List::of);
    }

    private boolean canSubmit(Schedule schedule) {
        return schedule.getStatus() == ScheduleStatus.COLLECTING_PREFERENCES
                && schedule.getPreferenceDeadline() != null
                && TimeProvider.now().isBefore(schedule.getPreferenceDeadline());
    }

    private SchedulePreferenceParticipantDto toParticipantDto(RestaurantMember member, SchedulePreferenceSubmission submission) {
        return new SchedulePreferenceParticipantDto(
                member.getId(),
                member.getUser() == null ? null : member.getUser().getId(),
                displayName(member),
                member.getPosition() == null ? null : member.getPosition().getId(),
                member.getPosition() == null ? null : member.getPosition().getName(),
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
                toMemberDto(submission.getMember()),
                submission.getPositionId(),
                submission.getPositionName(),
                submission.getSubmittedAt(),
                submission.getUpdatedAt(),
                submission.getRevision(),
                submission.getPeriodComment(),
                submission.getPeriodComment(),
                toCellDtos(submission.getCells())
        );
    }

    private SchedulePreferenceMemberDto toMemberDto(RestaurantMember member) {
        return new SchedulePreferenceMemberDto(
                member.getId(),
                member.getUser() == null ? null : member.getUser().getId(),
                displayName(member),
                member.getPosition() == null ? null : member.getPosition().getId(),
                member.getPosition() == null ? null : member.getPosition().getName()
        );
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

    private String firstNonBlank(String first, String fallback) {
        return isBlank(first) ? fallback : first;
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

    private boolean isValidPreferenceInterval(LocalTime startTime, LocalTime endTime) {
        if (startTime.equals(endTime)) {
            return false;
        }
        if (startTime.isBefore(endTime)) {
            return true;
        }
        return endTime.equals(END_OF_DAY_TIME);
    }

    private record CellKey(LocalDate day, SchedulePreferenceType type, boolean fullDay, LocalTime startTime, LocalTime endTime) {}
}
