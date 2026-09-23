package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.dictionary.model.Position;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.exception.ScheduleVersionConflictException;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleShiftRequestRepository;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAuditService;
import ru.staffly.schedule.service.ScheduleChangeService;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.schedule.service.ScheduleParticipationCreator;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleServiceImpl implements ScheduleService {

    private static final String[] WEEKDAY_LABELS = {"", "пн", "вт", "ср", "чт", "пт", "сб", "вс"};
    private static final String AUTO_REJECT_COMMENT = "Заявка отклонена автоматически: график был изменён.";
    private static final int HISTORY_LIMIT = 20;

    private final ScheduleRepository schedules;
    private final ScheduleBuildTemplateRepository buildTemplates;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final ScheduleShiftRequestRepository shiftRequests;
    private final SchedulePreferenceSubmissionRepository preferenceSubmissions;
    private final ScheduleParticipationRepository participations;
    private final ScheduleParticipationCreator participationCreator;
    private final RestaurantMemberRepository members;
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleAuditService scheduleAuditService;
    private final ScheduleChangeService scheduleChangeService;
    private final UserRepository users;
    private final InboxMessageService inboxMessages;

    @Override
    public ScheduleDto create(Long restaurantId, Long userId, CreateScheduleRequest request) {
        return createWithStatus(restaurantId, userId, request, ScheduleStatus.PUBLISHED, "График создан");
    }

    @Override
    public ScheduleDto createDraft(Long restaurantId, Long userId, CreateScheduleRequest request) {
        return createWithStatus(restaurantId, userId, request, ScheduleStatus.DRAFT, "Черновик графика создан");
    }

    private ScheduleDto createWithStatus(Long restaurantId,
                                         Long userId,
                                         CreateScheduleRequest request,
                                         ScheduleStatus status,
                                         String auditDetails) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        ScheduleConfigDto config = Objects.requireNonNull(request.config(), "config");
        LocalDate startDate = parseDate(config.startDate(), "startDate");
        LocalDate endDate = parseDate(config.endDate(), "endDate");
        if (endDate.isBefore(startDate)) {
            throw new BadRequestException("endDate must not be before startDate");
        }
        long length = startDate.datesUntil(endDate.plusDays(1)).count();
        if (length > 32) {
            throw new BadRequestException("Schedule cannot be longer than 32 days");
        }

        ScheduleShiftMode shiftMode = Objects.requireNonNull(config.shiftMode(), "shiftMode");

        Set<Position> schedulePositions = resolvePositions(restaurantId, config.positionIds());

        List<LocalDate> days = collectDays(startDate, endDate);

        String baseTitle = Optional.ofNullable(request.title()).map(String::trim).filter(s -> !s.isEmpty())
                .orElse("График");
        String title = makeUniqueTitle(restaurantId, baseTitle, null);

        Schedule schedule = Schedule.builder()
                .restaurant(restaurant)
                .title(title)
                .startDate(startDate)
                .endDate(endDate)
                .shiftMode(shiftMode)
                .status(status)
                .showFullName(config.showFullName())
                .positions(schedulePositions)
                .build();

        applyOwnerAndCreator(schedule, restaurantId, userId, request.ownerUserId());
        List<ScheduleRowRequest> requestedRows = request.rows() == null ? List.of() : request.rows();
        Map<Long, RestaurantMember> lockedMembers = lockRequestedMembers(restaurantId, requestedRows);
        Schedule saved = schedules.saveAndFlush(schedule);
        List<ScheduleRow> rowEntities = buildRows(
                saved, requestedRows, request.cellValues(), request.cellShifts(), days, lockedMembers
        );
        saved.getRows().addAll(rowEntities);
        saved = schedules.saveAndFlush(saved);
        scheduleAuditService.record(saved, userId, ScheduleAuditAction.CREATED, auditDetails);
        if (status == ScheduleStatus.PUBLISHED) {
            notifySchedulePublished(saved, userId);
        }
        return toDto(saved, days);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleSummaryDto> list(Long restaurantId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);

        final boolean canManage = scheduleAccessService.canManageSchedules(userId, restaurantId);
        Optional<RestaurantMember> membership = members.findByUserIdAndRestaurantId(userId, restaurantId);
        if (!canManage && membership.isEmpty()) {
            return List.of();
        }
        final RestaurantMember currentMember = membership.orElse(null);
        final Long memberId = currentMember != null ? currentMember.getId() : null;
        List<Schedule> visibleCandidates;
        if (canManage) {
            visibleCandidates = schedules.findByRestaurantIdOrderByCreatedAtDesc(restaurantId);
        } else if (currentMember != null) {
            visibleCandidates = schedules.findByRestaurantIdAndParticipantMemberId(restaurantId, currentMember.getId());
        } else {
            return List.of();
        }

        return visibleCandidates.stream()
                .filter(schedule -> scheduleAccessService.canViewScheduleSummary(userId, schedule))
                .map(s -> {
                    PreferenceProgressSummary progress = resolvePreferenceProgressSummary(canManage, s);
                    Boolean myPreferenceSubmitted = resolveMyPreferenceSubmitted(s, currentMember, userId);
                    return new ScheduleSummaryDto(
                        s.getId(),
                        s.getVersion(),
                        s.getTitle(),
                        s.getStartDate().toString(),
                        s.getEndDate().toString(),
                        s.getCreatedAt(),
                        canManage
                                ? shiftRequests.existsByScheduleIdAndStatus(
                                s.getId(),
                                ScheduleShiftRequestStatus.PENDING_MANAGER
                        )
                                : memberId != null && shiftRequests.existsActiveForMember(
                                s.getId(),
                                ScheduleShiftRequestStatus.PENDING_MANAGER,
                                memberId
                        ),
                        SchedulePositionIds.ids(s),
                        buildOwnerDto(s),
                        s.getStatus(),
                        s.getPreferenceCollectionStartedAt(),
                        s.getPreferenceDeadline(),
                        s.getPreferenceClosedAt(),
                        s.getPreferenceAppliedAt(),
                        progress.submittedCount(),
                        progress.totalParticipants(),
                        myPreferenceSubmitted
                );
                })
                .toList();
    }

    private Boolean resolveMyPreferenceSubmitted(Schedule schedule, RestaurantMember currentMember, Long currentUserId) {
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES || currentMember == null) {
            return null;
        }
        if (isScheduleOwner(schedule, currentMember, currentUserId)) {
            return null;
        }
        if (!participations.existsByScheduleIdAndMemberId(schedule.getId(), currentMember.getId())) {
            return null;
        }
        return preferenceSubmissions.existsByScheduleIdAndMemberId(schedule.getId(), currentMember.getId());
    }

    private boolean isScheduleOwner(Schedule schedule, RestaurantMember currentMember, Long currentUserId) {
        Long ownerMemberId = schedule.getOwnerMember() != null ? schedule.getOwnerMember().getId() : null;
        if (ownerMemberId != null && currentMember != null && ownerMemberId.equals(currentMember.getId())) {
            return true;
        }
        Long ownerUserId = schedule.getOwnerUser() != null ? schedule.getOwnerUser().getId() : null;
        return ownerUserId != null && currentUserId != null && ownerUserId.equals(currentUserId);
    }

    private PreferenceProgressSummary resolvePreferenceProgressSummary(boolean canManage, Schedule schedule) {
        if (!canManage || schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES) {
            return PreferenceProgressSummary.empty();
        }
        List<RestaurantMember> participants = participations.findByScheduleIdOrderById(schedule.getId()).stream()
                .map(ScheduleParticipation::getMember).toList();
        Set<Long> participantMemberIds = participants.stream()
                .map(RestaurantMember::getId)
                .collect(Collectors.toSet());
        if (participantMemberIds.isEmpty()) {
            return new PreferenceProgressSummary(0, 0);
        }

        int submittedCount = (int) preferenceSubmissions.findByScheduleIdWithMember(schedule.getId()).stream()
                .map(submission -> submission.getMember().getId())
                .filter(participantMemberIds::contains)
                .distinct()
                .count();
        return new PreferenceProgressSummary(submittedCount, participantMemberIds.size());
    }

    private record PreferenceProgressSummary(Integer submittedCount, Integer totalParticipants) {
        private static PreferenceProgressSummary empty() {
            return new PreferenceProgressSummary(null, null);
        }
    }

    @Override
    @Transactional(readOnly = true)
    public ScheduleDto get(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        scheduleAccessService.assertCanViewSchedule(userId, schedule);
        schedule.getRows().forEach(row -> row.getCells().size());
        List<LocalDate> days = collectDays(schedule.getStartDate(), schedule.getEndDate());
        return toDto(schedule, days);
    }

    @Override
    public ScheduleDto update(Long restaurantId, Long scheduleId, Long userId, UpdateScheduleRequest request) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        List<ScheduleRowRequest> requestedRows = request.rows() != null ? request.rows() : List.of();
        Map<Long, RestaurantMember> lockedRequestedMembers = lockRequestedMembers(restaurantId, requestedRows);
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, request.version());
        assertCanUpdateScheduleContent(schedule);

        boolean publishedEdit = schedule.getStatus() == ScheduleStatus.PUBLISHED;
        ScheduleConfigDto config = Objects.requireNonNull(request.config(), "config");
        LocalDate startDate = parseDate(config.startDate(), "startDate");
        LocalDate endDate = parseDate(config.endDate(), "endDate");
        if (endDate.isBefore(startDate)) {
            throw new BadRequestException("endDate must not be before startDate");
        }
        long length = startDate.datesUntil(endDate.plusDays(1)).count();
        if (length > 32) {
            throw new BadRequestException("Schedule cannot be longer than 32 days");
        }

        ScheduleShiftMode shiftMode = Objects.requireNonNull(config.shiftMode(), "shiftMode");

        Set<Position> schedulePositions = resolvePositions(restaurantId, config.positionIds());

        List<LocalDate> days = collectDays(startDate, endDate);

        String baseTitle = Optional.ofNullable(request.title()).map(String::trim).filter(s -> !s.isEmpty())
                .orElse("График");
        String title = makeUniqueTitle(restaurantId, baseTitle, schedule.getTitle());

        boolean aggregateChanged = !Objects.equals(schedule.getTitle(), title)
                || !Objects.equals(schedule.getStartDate(), startDate)
                || !Objects.equals(schedule.getEndDate(), endDate)
                || schedule.getShiftMode() != shiftMode
                || schedule.isShowFullName() != config.showFullName()
                || !new HashSet<>(SchedulePositionIds.ids(schedule)).equals(
                        schedulePositions.stream().map(Position::getId).collect(Collectors.toSet()));

        List<ScheduleRowRequest> safeRows = requestedRows;
        Map<String, String> newValues = request.cellValues() != null ? request.cellValues() : Map.of();
        Set<Long> requestedPositionIds = schedulePositions.stream().map(Position::getId).collect(Collectors.toSet());
        Map<Long, RestaurantMember> memberMap = validateAndMapMembers(
                schedule, safeRows, requestedPositionIds, lockedRequestedMembers);
        Map<String, String> oldValueMap = buildCurrentValueMap(schedule);
        Map<String, String> newValueMap = buildRequestedValueMap(newValues, days, memberMap.keySet());
        List<PublishedScheduleCellChange> publishedChanges = publishedEdit
                ? buildPublishedChanges(schedule, memberMap, days, newValues)
                : List.of();
        autoRejectAffectedPendingRequests(
                schedule, userId, oldValueMap, newValueMap, memberMap.keySet(), new HashSet<>(days)
        );
        schedule.setTitle(title);
        schedule.setStartDate(startDate);
        schedule.setEndDate(endDate);
        schedule.setShiftMode(shiftMode);
        schedule.setShowFullName(config.showFullName());
        schedule.setPositions(schedulePositions);
        Map<Long, ScheduleParticipation> participationByMemberId = ensureParticipations(
                schedule, memberMap.values());
        applyRowsDiff(schedule, newValues,
                request.cellShifts() != null ? request.cellShifts() : Map.of(),
                days, memberMap, participationByMemberId);
        schedule.setUpdatedAt(TimeProvider.now());

        Schedule saved = schedules.saveAndFlush(schedule);
        if (!publishedEdit || aggregateChanged || !publishedChanges.isEmpty()) {
            scheduleAuditService.record(saved, userId, ScheduleAuditAction.UPDATED, "График изменён");
        }
        if (publishedEdit && (aggregateChanged || !publishedChanges.isEmpty())) {
            User actor = users.findById(userId)
                    .orElseThrow(() -> new NotFoundException("User not found: " + userId));
            Set<Long> notifiedEmployeeUserIds = new HashSet<>();
            if (!publishedChanges.isEmpty()) {
                ScheduleChange batch = persistPublishedChanges(saved, actor, publishedChanges);
                notifiedEmployeeUserIds = notifyAffectedEmployees(
                        saved, actor, batch, publishedChanges, memberMap
                );
            }
            notifyOwnerIfNeeded(saved, actor, publishedChanges, notifiedEmployeeUserIds);
        }
        saved.getRows().forEach(row -> row.getCells().size());
        return toDto(saved, days);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleChangeDto> getChanges(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);
        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        return scheduleChangeService.getHistory(schedule);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AddableScheduleMemberDto> getAddableMembers(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertCanUpdateScheduleContent(schedule);

        Set<Long> existingMemberIds = participations.findByScheduleIdOrderById(scheduleId).stream()
                .map(value -> value.getMember().getId())
                .collect(Collectors.toSet());

        return findEligibleMembers(schedule).stream()
                .filter(member -> member.getUser() != null && member.getPosition() != null)
                .filter(member -> !existingMemberIds.contains(member.getId()))
                .map(this::toAddableMemberDto)
                .sorted(Comparator.comparing(AddableScheduleMemberDto::displayName, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(AddableScheduleMemberDto::memberId))
                .toList();
    }

    @Override
    @Transactional
    public ScheduleDto addMember(Long restaurantId, Long scheduleId, Long userId, Long expectedVersion, Long memberId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        RestaurantMember member = members.findForUpdateByIdAndRestaurantId(memberId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + memberId));
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);
        assertCanUpdateScheduleContent(schedule);

        List<Long> positionIds = SchedulePositionIds.ids(schedule);
        if (member.getUser() == null || member.getPosition() == null
                || !positionIds.contains(member.getPosition().getId())) {
            throw new BadRequestException("Сотрудник не подходит по должности для этого графика");
        }
        if (schedule.getRows().stream().anyMatch(row -> Objects.equals(row.getMemberId(), memberId))) {
            throw new ConflictException("Сотрудник уже представлен в графике");
        }

        int nextSortOrder = schedule.getRows().stream()
                .mapToInt(ScheduleRow::getSortOrder)
                .max()
                .orElse(-1) + 1;
        ScheduleParticipation participation = participationCreator
                .createWithLocksHeld(schedule, member, true).participation();
        schedule.getRows().add(ScheduleRow.builder()
                .schedule(schedule)
                .memberId(member.getId())
                .displayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""))
                .positionId(participation.getPositionId())
                .positionName(participation.getPositionName())
                .sortOrder(nextSortOrder)
                .build());

        schedule.setUpdatedAt(TimeProvider.now());
        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(saved, userId, ScheduleAuditAction.UPDATED, "Сотрудник добавлен в график");
        return toDto(saved, collectDays(saved.getStartDate(), saved.getEndDate()));
    }

    private List<RestaurantMember> findEligibleMembers(Schedule schedule) {
        List<Long> allowedPositionIds = SchedulePositionIds.ids(schedule);
        if (allowedPositionIds.isEmpty()) {
            return List.of();
        }
        return members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                schedule.getRestaurant().getId(), allowedPositionIds
        );
    }

    private Map<Long, ScheduleParticipation> ensureParticipations(
            Schedule schedule, Collection<RestaurantMember> lockedCandidates) {
        return participationCreator.createMissingWithLocksHeld(schedule, lockedCandidates, true);
    }

    private AddableScheduleMemberDto toAddableMemberDto(RestaurantMember member) {
        return new AddableScheduleMemberDto(
                member.getId(),
                member.getUser() == null
                        ? ""
                        : Optional.ofNullable(member.getUser().getFullName()).orElse(""),
                member.getPosition().getId(),
                member.getPosition().getName()
        );
    }

    private void assertCanUpdateScheduleContent(Schedule schedule) {
        if (schedule.getStatus() == ScheduleStatus.COLLECTING_PREFERENCES
                || schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED) {
            throw new BadRequestException("График в текущем статусе нельзя редактировать обычным способом");
        }
    }

    private void assertExpectedVersion(Schedule schedule, Long expectedVersion) {
        if (expectedVersion == null || !Objects.equals(schedule.getVersion(), expectedVersion)) {
            throw new ScheduleVersionConflictException(expectedVersion, schedule.getVersion());
        }
    }

    @Override
    public ScheduleDto startPreferenceCollection(Long restaurantId,
                                                 Long scheduleId,
                                                 Long actorUserId,
                                                 StartPreferenceCollectionRequest request) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);

        // Discover without locking, then acquire the global Member -> Schedule -> Template order.
        List<Long> discoveredPositionIds = schedules.findPositionIdsByIdAndRestaurantId(scheduleId, restaurantId);
        List<Long> candidateIds = discoveredPositionIds.isEmpty() ? List.of()
                : members.findByRestaurantIdAndPositionIdIn(restaurantId, discoveredPositionIds).stream()
                .map(RestaurantMember::getId).sorted().toList();
        List<RestaurantMember> lockedCandidates = candidateIds.isEmpty() ? List.of()
                : members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, candidateIds);
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, request.version());
        if (schedule.getStatus() != ScheduleStatus.DRAFT) {
            throw new BadRequestException("Сбор пожеланий можно начать только из черновика графика");
        }
        Instant deadline = request != null ? request.preferenceDeadline() : null;
        if (deadline == null) {
            throw new BadRequestException("preferenceDeadline is required");
        }
        Instant now = TimeProvider.now();
        if (!deadline.isAfter(now)) {
            throw new BadRequestException("preferenceDeadline must be in the future");
        }

        PreferenceCollectionMode mode = request == null ? null : request.mode();
        if (mode == null) {
            throw new BadRequestException("Выберите способ сбора пожеланий");
        }
        Long buildTemplateId = request.buildTemplateId();
        validatePreferenceCollectionModeSelection(mode, buildTemplateId);
        ScheduleBuildTemplate preferenceBuildTemplate = mode == PreferenceCollectionMode.SHIFT_OPTIONS
                ? resolvePreferenceBuildTemplateForUpdate(restaurantId, schedule, buildTemplateId)
                : null;

        // All validation above precedes aggregate mutation. Clearing also removes stale
        // dictionaries should a future lifecycle permit a new collection iteration.
        schedule.getPreferenceShiftOptionSnapshots().clear();
        if (mode == PreferenceCollectionMode.SHIFT_OPTIONS) {
            replacePreferenceShiftOptionSnapshot(schedule, preferenceBuildTemplate);
        }
        Set<Long> lockedSchedulePositionIds = new HashSet<>(SchedulePositionIds.ids(schedule));
        if (!lockedSchedulePositionIds.equals(new HashSet<>(discoveredPositionIds))) {
            throw new ConflictException("Позиции графика изменились. Повторите начало сбора пожеланий");
        }
        List<RestaurantMember> eligibleLockedCandidates = lockedCandidates.stream()
                .filter(member -> member.getPosition() != null
                        && lockedSchedulePositionIds.contains(member.getPosition().getId()))
                .toList();
        Set<Long> revalidatedCandidateIds = lockedSchedulePositionIds.isEmpty() ? Set.of()
                : members.findByRestaurantIdAndPositionIdIn(
                                restaurantId, lockedSchedulePositionIds.stream().sorted().toList()).stream()
                        .map(RestaurantMember::getId).collect(Collectors.toSet());
        Set<Long> lockedEligibleCandidateIds = eligibleLockedCandidates.stream()
                .map(RestaurantMember::getId).collect(Collectors.toSet());
        if (!revalidatedCandidateIds.equals(lockedEligibleCandidateIds)) {
            throw new ConflictException("Состав подходящих сотрудников изменился. Повторите начало сбора пожеланий");
        }
        ensureParticipations(schedule, eligibleLockedCandidates);
        schedule.setStatus(ScheduleStatus.COLLECTING_PREFERENCES);
        schedule.setPreferenceCollectionMode(mode);
        schedule.setPreferenceBuildTemplate(preferenceBuildTemplate);
        schedule.setPreferenceCollectionStartedAt(now);
        schedule.setPreferenceDeadline(deadline);
        schedule.setPreferenceClosedAt(null);
        schedule.setPreferenceAppliedAt(null);
        schedule.setPreferenceAllSubmittedNotifiedAt(null);
        schedule.setPreferenceCollectionCycle(schedule.getPreferenceCollectionCycle() + 1);

        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(
                saved,
                actorUserId,
                ScheduleAuditAction.PREFERENCE_COLLECTION_STARTED,
                "Начат сбор пожеланий сотрудников"
        );
        notifyPreferenceCollectionStarted(saved, actorUserId);
        return toDto(saved, collectDays(saved.getStartDate(), saved.getEndDate()));
    }

    static void validatePreferenceCollectionModeSelection(PreferenceCollectionMode mode, Long buildTemplateId) {
        if (mode == PreferenceCollectionMode.DAY_LEVEL && buildTemplateId != null) {
            throw new BadRequestException("Для сбора без выбора времени шаблон сборки указывать нельзя");
        }
        if (mode == PreferenceCollectionMode.SHIFT_OPTIONS && buildTemplateId == null) {
            throw new BadRequestException("Выберите шаблон сборки для сбора пожеланий с вариантами смен");
        }
    }

    private ScheduleBuildTemplate resolvePreferenceBuildTemplateForUpdate(Long restaurantId, Schedule schedule, Long buildTemplateId) {
        ScheduleBuildTemplate template = buildTemplates.findForUpdateByIdAndRestaurantId(buildTemplateId, restaurantId)
                .orElseThrow(() -> new BadRequestException("Активный шаблон сборки не найден"));
        if (!template.isActive()) {
            throw new BadRequestException("Активный шаблон сборки не найден");
        }
        initializeBuildTemplateCollections(template);
        validatePreferenceTemplatePositionCoverage(schedule, template);
        return template;
    }

    static void validatePreferenceTemplatePositionCoverage(Schedule schedule, ScheduleBuildTemplate template) {
        List<Position> schedulePositions = Optional.ofNullable(schedule.getPositions()).orElseGet(Set::of).stream()
                .filter(position -> position.getId() != null)
                .collect(Collectors.toMap(Position::getId, position -> position, (left, right) -> left))
                .values().stream()
                .sorted(Comparator.comparing(Position::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Position::getId))
                .toList();

        Map<Long, List<ScheduleBuildPositionConfig>> ownersByPositionId = new HashMap<>();
        for (ScheduleBuildPositionConfig config : Optional.ofNullable(template.getPositionConfigs()).orElseGet(List::of)) {
            for (Long positionId : config.getPositions() == null ? List.<Long>of() : config.getPositions().stream()
                    .map(Position::getId)
                    .filter(Objects::nonNull)
                    .distinct()
                    .toList()) {
                ownersByPositionId.computeIfAbsent(positionId, ignored -> new ArrayList<>()).add(config);
            }
        }

        List<Position> missing = schedulePositions.stream()
                .filter(position -> ownersByPositionId.getOrDefault(position.getId(), List.of()).isEmpty())
                .toList();
        if (!missing.isEmpty()) {
            throw new BadRequestException("Выбранный шаблон не настроен для всех должностей графика: "
                    + positionNames(missing));
        }

        List<Position> duplicated = schedulePositions.stream()
                .filter(position -> ownersByPositionId.getOrDefault(position.getId(), List.of()).size() > 1)
                .toList();
        if (!duplicated.isEmpty()) {
            throw new BadRequestException("В выбранном шаблоне несколько настроек для должностей графика: "
                    + positionNames(duplicated));
        }

        List<Position> withoutShiftOptions = schedulePositions.stream()
                .filter(position -> {
                    ScheduleBuildPositionConfig owner = ownersByPositionId.get(position.getId()).get(0);
                    return owner.getShiftOptions() == null || owner.getShiftOptions().isEmpty();
                })
                .toList();
        if (!withoutShiftOptions.isEmpty()) {
            throw new BadRequestException("В выбранном шаблоне нет вариантов смен для должностей графика: "
                    + positionNames(withoutShiftOptions));
        }
    }

    private static String positionNames(List<Position> positions) {
        return positions.stream()
                .map(position -> position.getName() == null || position.getName().isBlank()
                        ? String.valueOf(position.getId())
                        : position.getName())
                .collect(Collectors.joining(", "));
    }

    static void replacePreferenceShiftOptionSnapshot(Schedule schedule, ScheduleBuildTemplate template) {
        schedule.getPreferenceShiftOptionSnapshots().clear();
        Set<Long> schedulePositionIds = new HashSet<>(SchedulePositionIds.ids(schedule));
        int order = 0;
        for (ScheduleBuildPositionConfig config : template.getPositionConfigs().stream()
                .sorted(Comparator.comparing(ScheduleBuildPositionConfig::getSortOrder,
                        Comparator.nullsLast(Integer::compareTo)))
                .toList()) {
            Set<Long> positionIds = buildConfigPositionIds(config).stream()
                    .filter(schedulePositionIds::contains)
                    .collect(Collectors.toCollection(LinkedHashSet::new));
            if (positionIds.isEmpty()) {
                continue;
            }
            for (ScheduleBuildShiftOption option : config.getShiftOptions().stream()
                    .sorted(Comparator.comparing(ScheduleBuildShiftOption::getSortOrder,
                                    Comparator.nullsLast(Integer::compareTo))
                            .thenComparing(ScheduleBuildShiftOption::getId))
                    .toList()) {
                SchedulePreferenceShiftOptionSnapshot snapshot = SchedulePreferenceShiftOptionSnapshot.builder()
                        .schedule(schedule)
                        .sourceShiftOptionId(option.getId())
                        .label(option.getLabel())
                        .startTime(option.getStartTime())
                        .endTime(option.getEndTime())
                        .sortOrder(order++)
                        .positionIds(new LinkedHashSet<>(positionIds))
                        .build();
                schedule.getPreferenceShiftOptionSnapshots().add(snapshot);
            }
        }
    }

    private void initializeBuildTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            Hibernate.initialize(config.getPositions());
            Hibernate.initialize(config.getShiftOptions());
        }
    }

    private static List<Long> buildConfigPositionIds(ScheduleBuildPositionConfig config) {
        return config.getPositions() == null ? List.of() : config.getPositions().stream()
                .map(position -> position.getId())
                .filter(Objects::nonNull)
                .sorted()
                .toList();
    }

    @Override
    public ScheduleDto closePreferenceCollection(Long restaurantId, Long scheduleId, Long actorUserId,
                                                 Long expectedVersion) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);

        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);
        if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES) {
            throw new BadRequestException("Сбор пожеланий можно закрыть только для графика в режиме сбора пожеланий");
        }

        schedule.setStatus(ScheduleStatus.PREFERENCES_CLOSED);
        schedule.setPreferenceClosedAt(TimeProvider.now());

        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(
                saved,
                actorUserId,
                ScheduleAuditAction.PREFERENCE_COLLECTION_CLOSED,
                "Сбор пожеланий сотрудников закрыт"
        );
        return toDto(saved, collectDays(saved.getStartDate(), saved.getEndDate()));
    }


    @Override
    public ScheduleDto applyPreferencesSimple(Long restaurantId, Long scheduleId, Long actorUserId,
                                              Long expectedVersion) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);

        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);
        if (schedule.getStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            return toDto(schedule, collectDays(schedule.getStartDate(), schedule.getEndDate()));
        }
        if (schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED) {
            throw new BadRequestException("Внести пожелания можно только после закрытия сбора пожеланий");
        }

        schedule.setStatus(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        schedule.setPreferenceAppliedAt(TimeProvider.now());

        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(
                saved,
                actorUserId,
                ScheduleAuditAction.PREFERENCES_APPLIED,
                "Пожелания сотрудников подготовлены для ручной сборки графика"
        );
        return toDto(saved, collectDays(saved.getStartDate(), saved.getEndDate()));
    }

    @Override
    public ScheduleDto publish(Long restaurantId, Long scheduleId, Long actorUserId, Long expectedVersion) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);

        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);
        if (schedule.getStatus() != ScheduleStatus.DRAFT
                && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Опубликовать можно только черновик графика");
        }

        schedule.setStatus(ScheduleStatus.PUBLISHED);

        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(
                saved,
                actorUserId,
                ScheduleAuditAction.PUBLISHED,
                "График опубликован"
        );
        notifySchedulePublished(saved, actorUserId);
        return toDto(saved, collectDays(saved.getStartDate(), saved.getEndDate()));
    }

    @Override
    public void delete(Long restaurantId, Long scheduleId, Long userId, Long expectedVersion) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);

        scheduleAuditService.record(schedule, userId, ScheduleAuditAction.DELETED, "График удалён");
        schedules.delete(schedule);
    }

    private List<ScheduleRow> buildRows(Schedule schedule,
                                        List<ScheduleRowRequest> rows,
                                        Map<String, String> cellValues,
                                        Map<String, ScheduleCellShiftDto> cellShifts,
                                        List<LocalDate> days,
                                        Map<Long, RestaurantMember> lockedMembers) {
        List<ScheduleRowRequest> safeRows = rows != null ? rows : List.of();
        Map<String, String> values = cellValues != null ? cellValues : Map.of();

        List<ScheduleRow> entities = new ArrayList<>(safeRows.size());
        Map<Long, RestaurantMember> membersById = lockedMembers;
        Map<Long, ScheduleParticipation> participationByMemberId = ensureParticipations(
                schedule, membersById.values());
        Set<Long> schedulePositionIds = new HashSet<>(SchedulePositionIds.ids(schedule));
        Set<Long> seenMemberIds = new HashSet<>();
        int index = 0;
        for (ScheduleRowRequest row : safeRows) {
            if (row.memberId() == null) {
                throw new BadRequestException("memberId is required for each row");
            }
            RestaurantMember member = Optional.ofNullable(membersById.get(row.memberId()))
                    .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + row.memberId()));
            if (!Objects.equals(member.getRestaurant().getId(), schedule.getRestaurant().getId())) {
                throw new ForbiddenException("Нельзя добавить сотрудника из другого ресторана");
            }
            if (member.getUser() == null) { throw new BadRequestException("У сотрудника нет пользователя"); }
            if (member.getPosition() == null) { throw new BadRequestException("У сотрудника не задана должность"); }
            if (!schedulePositionIds.contains(member.getPosition().getId())) {
                throw new BadRequestException("Должность сотрудника не входит в позиции графика");
            }
            if (!seenMemberIds.add(member.getId())) { throw new BadRequestException("Один и тот же сотрудник не может быть добавлен дважды"); }
            ScheduleParticipation participation = participationByMemberId.get(member.getId());
            ScheduleRow entity = ScheduleRow.builder()
                    .schedule(schedule)
                    .memberId(member.getId())
                    .displayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""))
                    .positionId(participation.getPositionId())
                    .positionName(participation.getPositionName())
                    .sortOrder(index++)
                    .build();

            List<ScheduleCell> cells = buildCells(entity, member.getId(), values,
                    cellShifts != null ? cellShifts : Map.of(), days);
            entity.setCells(cells);
            entities.add(entity);
        }
        return entities;
    }

    private List<ScheduleCell> buildCells(ScheduleRow row,
                                          Long memberId,
                                          Map<String, String> values,
                                          Map<String, ScheduleCellShiftDto> shifts,
                                          List<LocalDate> days) {
        List<ScheduleCell> cells = new ArrayList<>();
        for (LocalDate day : days) {
            String key = memberId + ":" + day;
            String value = values.get(key);
            if (value == null) {
                continue;
            }
            String trimmed = value.trim();
            if (trimmed.isEmpty()) {
                continue;
            }
            ScheduleCell cell = ScheduleCell.builder()
                    .row(row)
                    .day(day)
                    .value(trimmed)
                    .source(ScheduleCellSource.MANUAL)
                    .build();
            applyStructuredShift(cell, shifts.get(key));
            cells.add(cell);
        }
        return cells;
    }

    private Map<Long, RestaurantMember> validateAndMapMembers(Schedule schedule, List<ScheduleRowRequest> rows,
                                                               Set<Long> allowedPositionIds,
                                                               Map<Long, RestaurantMember> membersById) {
        Map<Long, RestaurantMember> memberMap = new LinkedHashMap<>();
        Map<Long, ScheduleParticipation> participationByMemberId = participations
                .findByScheduleIdOrderById(schedule.getId()).stream()
                .collect(Collectors.toMap(value -> value.getMember().getId(), value -> value));
        Set<Long> historicalMemberIds = schedule.getRows().stream()
                .map(ScheduleRow::getMemberId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        for (ScheduleRowRequest row : rows) {
            if (row.memberId() == null) {
                throw new BadRequestException("memberId is required for each row");
            }
            RestaurantMember member = Optional.ofNullable(membersById.get(row.memberId()))
                    .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + row.memberId()));
            if (!Objects.equals(member.getRestaurant().getId(), schedule.getRestaurant().getId())) {
                throw new ForbiddenException("Нельзя добавить сотрудника из другого ресторана");
            }
            ScheduleParticipation participation = participationByMemberId.get(member.getId());
            if (participation == null && historicalMemberIds.contains(member.getId())) {
                // A materialized row is history, not membership. Re-adding a former
                // participant must go through the explicit add-member boundary.
                continue;
            }
            Long authoritativePositionId = participation == null
                    ? (member.getPosition() == null ? null : member.getPosition().getId())
                    : participation.getPositionId();
            boolean currentlyEligible = member.getUser() != null
                    && authoritativePositionId != null
                    && allowedPositionIds.contains(authoritativePositionId);
            if (!currentlyEligible) {
                // A client can still hold a row that became inactive after it loaded the schedule
                // (member position or schedule positions changed). Treat it as retained history,
                // not as an active edit and not as an attempt to add an ineligible employee.
                if (historicalMemberIds.contains(member.getId())) {
                    continue;
                }
                if (member.getUser() == null) throw new BadRequestException("У сотрудника нет пользователя");
                if (member.getPosition() == null) throw new BadRequestException("У сотрудника не задана должность");
                throw new BadRequestException("Должность сотрудника не входит в позиции графика");
            }
            if (memberMap.putIfAbsent(member.getId(), member) != null) {
                throw new BadRequestException("Один и тот же сотрудник не может быть добавлен дважды");
            }
        }
        return memberMap;
    }

    private Map<Long, RestaurantMember> lockRequestedMembers(Long restaurantId, List<ScheduleRowRequest> rows) {
        List<Long> memberIds = rows.stream().filter(Objects::nonNull)
                .map(ScheduleRowRequest::memberId).filter(Objects::nonNull)
                .distinct().sorted().toList();
        if (memberIds.isEmpty()) return Map.of();
        return members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, memberIds).stream()
                .collect(Collectors.toMap(RestaurantMember::getId, member -> member));
    }

    private Map<String, String> buildCurrentValueMap(Schedule schedule) {
        return schedule.getRows().stream()
                .filter(row -> row.getMemberId() != null)
                .flatMap(row -> row.getCells().stream()
                        .map(cell -> Map.entry(row.getMemberId() + ":" + cell.getDay(), normalizeCellValue(cell.getValue()))))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));
    }

    private Map<String, String> buildRequestedValueMap(Map<String, String> values, List<LocalDate> days, Collection<Long> memberIds) {
        Map<String, String> result = new HashMap<>();
        for (Long memberId : memberIds) {
            for (LocalDate day : days) {
                String key = memberId + ":" + day;
                result.put(key, normalizeCellValue(values.get(key)));
            }
        }
        return result;
    }

    private void autoRejectAffectedPendingRequests(Schedule schedule,
                                                   Long userId,
                                                   Map<String, String> oldMap,
                                                   Map<String, String> newMap,
                                                   Set<Long> newMemberIds,
                                                   Set<LocalDate> newPeriodDays) {
        List<ScheduleShiftRequest> pending = shiftRequests.findForUpdateByScheduleIdAndStatus(
                schedule.getId(), ScheduleShiftRequestStatus.PENDING_MANAGER
        );
        for (ScheduleShiftRequest request : pending) {
            boolean changed = requestCells(request).stream().anyMatch(cell ->
                    isImportantCellChanged(cell.memberId(), cell.day(), oldMap, newMap, newMemberIds, newPeriodDays));
            if (!changed) continue;
            request.setStatus(ScheduleShiftRequestStatus.REJECTED_BY_MANAGER);
            request.setDecidedByUserId(userId);
            request.setDecidedAt(TimeProvider.now());
            request.setDecisionComment(AUTO_REJECT_COMMENT);
            scheduleAuditService.record(
                    schedule,
                    userId,
                    ScheduleAuditAction.SHIFT_REQUEST_AUTO_REJECTED,
                    "Заявка отклонена автоматически: график был изменён"
            );
            notifyAutoRejectedRequest(request, userId);
        }
    }

    private Set<RequestCellRef> requestCells(ScheduleShiftRequest request) {
        Set<RequestCellRef> keys = new HashSet<>();
        LocalDate dayFrom = request.getDayFrom();
        LocalDate dayTo = request.getDayTo();
        keys.add(new RequestCellRef(request.getFromMemberId(), dayFrom));
        keys.add(new RequestCellRef(request.getToMemberId(), dayFrom));
        if (request.getType() == ScheduleShiftRequestType.SWAP && dayTo != null) {
            keys.add(new RequestCellRef(request.getFromMemberId(), dayTo));
            keys.add(new RequestCellRef(request.getToMemberId(), dayTo));
        }
        return keys;
    }

    private boolean isImportantCellChanged(Long memberId,
                                           LocalDate day,
                                           Map<String, String> oldMap,
                                           Map<String, String> newMap,
                                           Set<Long> newMemberIds,
                                           Set<LocalDate> newPeriodDays) {
        // Rows omitted from the active-table payload are historical rows retained by the server.
        // Their cells were not edited and must not make an unrelated pending request look changed.
        if (!newMemberIds.contains(memberId)) {
            return false;
        }
        if (!newPeriodDays.contains(day)) {
            return true;
        }
        String key = memberId + ":" + day;
        return !Objects.equals(normalizeCellValue(oldMap.get(key)), normalizeCellValue(newMap.get(key)));
    }

    private void applyRowsDiff(Schedule schedule,
                               Map<String, String> values,
                               Map<String, ScheduleCellShiftDto> shifts,
                               List<LocalDate> days,
                               Map<Long, RestaurantMember> memberMap,
                               Map<Long, ScheduleParticipation> participationByMemberId) {
        Map<Long, ScheduleRow> existingByMemberId = schedule.getRows().stream()
                .filter(row -> row.getMemberId() != null)
                .collect(Collectors.toMap(ScheduleRow::getMemberId, r -> r, (left, right) -> left));
        Set<Long> requestedIds = new LinkedHashSet<>(memberMap.keySet());
        Set<ScheduleRow> activeRows = Collections.newSetFromMap(new IdentityHashMap<>());

        int index = 0;
        for (Long memberId : requestedIds) {
            RestaurantMember member = memberMap.get(memberId);
            ScheduleRow row = existingByMemberId.get(memberId);
            if (row == null) {
                row = ScheduleRow.builder().schedule(schedule).memberId(memberId).build();
                schedule.getRows().add(row);
                ScheduleParticipation participation = Objects.requireNonNull(
                        participationByMemberId.get(memberId), "Active row requires ScheduleParticipation");
                row.setPositionId(participation.getPositionId());
                row.setPositionName(participation.getPositionName());
            }
            activeRows.add(row);
            row.setHistorical(false);
            row.setDisplayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""));
            row.setSortOrder(index++);
            reconcileCells(row, memberId, values, shifts, days);
        }

        List<ScheduleRow> historicalRows = schedule.getRows().stream()
                .filter(row -> !activeRows.contains(row))
                .sorted(Comparator.comparingInt(ScheduleRow::getSortOrder)
                        .thenComparing(ScheduleRow::getId, Comparator.nullsLast(Long::compareTo)))
                .toList();
        for (ScheduleRow historicalRow : historicalRows) {
            historicalRow.setSortOrder(index++);
        }
    }

    private void reconcileCells(ScheduleRow row,
                                Long memberId,
                                Map<String, String> values,
                                Map<String, ScheduleCellShiftDto> shifts,
                                List<LocalDate> days) {
        Set<LocalDate> validDays = new HashSet<>(days);
        row.getCells().removeIf(cell -> !validDays.contains(cell.getDay()));
        Map<LocalDate, ScheduleCell> byDay = row.getCells().stream()
                .collect(Collectors.toMap(ScheduleCell::getDay, c -> c, (a, b) -> a));
        for (LocalDate day : days) {
            String key = memberId + ":" + day;
            String normalized = normalizeCellValue(values.get(key));
            ScheduleCell existing = byDay.get(day);
            ScheduleCellSource source = existing != null
                    && Objects.equals(normalizeCellValue(existing.getValue()), normalized)
                    ? existing.getSource()
                    : ScheduleCellSource.MANUAL;
            if (normalized == null) {
                if (existing != null) {
                    row.getCells().remove(existing);
                }
                continue;
            }
            if (existing == null || !row.getCells().contains(existing)) {
                row.getCells().add(ScheduleCell.builder()
                        .row(row)
                        .day(day)
                        .value(normalized)
                        .source(source)
                        .build());
            } else {
                existing.setValue(normalized);
                existing.setSource(source);
            }
            ScheduleCell persisted = existing == null || !row.getCells().contains(existing)
                    ? row.getCells().get(row.getCells().size() - 1) : existing;
            applyStructuredShift(persisted, shifts.get(key));
        }
    }

    private void applyStructuredShift(ScheduleCell cell, ScheduleCellShiftDto shift) {
        try {
            cell.setStructuredShift(shift == null ? null : shift.toInterval());
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Некорректный структурированный интервал смены");
        }
    }

    private String normalizeCellValue(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private List<PublishedScheduleCellChange> buildPublishedChanges(
            Schedule schedule,
            Map<Long, RestaurantMember> activeMembers,
            List<LocalDate> newDays,
            Map<String, String> requestedValues) {
        Map<Long, ScheduleRow> rowsByMember = schedule.getRows().stream()
                .filter(row -> row.getMemberId() != null && activeMembers.containsKey(row.getMemberId()))
                .collect(Collectors.toMap(ScheduleRow::getMemberId, row -> row, (left, right) -> left));
        Set<LocalDate> newDaySet = new HashSet<>(newDays);
        List<PublishedScheduleCellChange> result = new ArrayList<>();
        for (Map.Entry<Long, RestaurantMember> entry : activeMembers.entrySet()) {
            Long memberId = entry.getKey();
            RestaurantMember member = entry.getValue();
            ScheduleRow row = rowsByMember.get(memberId);
            Map<LocalDate, ScheduleCell> oldCells = row == null ? Map.of() : row.getCells().stream()
                    .collect(Collectors.toMap(ScheduleCell::getDay, cell -> cell, (left, right) -> left));
            Set<LocalDate> relevantDays = new TreeSet<>(newDaySet);
            relevantDays.addAll(oldCells.keySet()); // includes cells removed by a shortened period
            for (LocalDate day : relevantDays) {
                String key = memberId + ":" + day;
                ScheduleCell oldCell = oldCells.get(day);
                String oldValue = normalizeCellValue(oldCell == null ? null : oldCell.getValue());
                String newValue = newDaySet.contains(day) ? normalizeCellValue(requestedValues.get(key)) : null;
                if (Objects.equals(oldValue, newValue)) continue;
                result.add(new PublishedScheduleCellChange(
                        row == null ? null : row.getId(), memberId,
                        member.getUser() == null ? null : member.getUser().getId(),
                        safeDisplayName(member.getUser()),
                        day, oldValue, newValue,
                        oldCell == null ? null : oldCell.getSource(),
                        newValue == null ? null : ScheduleCellSource.MANUAL
                ));
            }
        }
        result.sort(Comparator.comparing(PublishedScheduleCellChange::day)
                .thenComparing(PublishedScheduleCellChange::memberId)
                .thenComparing(PublishedScheduleCellChange::rowId, Comparator.nullsLast(Long::compareTo)));
        return result;
    }

    private ScheduleChange persistPublishedChanges(Schedule schedule,
                                                    User actor,
                                                    List<PublishedScheduleCellChange> changes) {
        List<ScheduleChangeItem> items = changes.stream().map(cell -> ScheduleChangeItem.builder()
                .memberId(cell.memberId()).rowId(cell.rowId()).memberDisplayName(cell.memberDisplayName())
                .day(cell.day()).oldValue(cell.oldValue()).newValue(cell.newValue())
                .oldSource(cell.oldSource()).newSource(cell.newSource()).build()).toList();
        return scheduleChangeService.record(schedule, actor.getId(), safeDisplayName(actor), items);
    }

    private Set<Long> notifyAffectedEmployees(Schedule schedule,
                                              User actor,
                                              ScheduleChange batch,
                                              List<PublishedScheduleCellChange> changes,
                                              Map<Long, RestaurantMember> activeMembers) {
        Map<Long, List<PublishedScheduleCellChange>> byUser = changes.stream()
                .filter(cell -> cell.memberUserId() != null && !cell.memberUserId().equals(actor.getId()))
                .collect(Collectors.groupingBy(PublishedScheduleCellChange::memberUserId,
                        LinkedHashMap::new, Collectors.toList()));
        Set<Long> notifiedUserIds = new HashSet<>();
        for (Map.Entry<Long, List<PublishedScheduleCellChange>> entry : byUser.entrySet()) {
            RestaurantMember target = entry.getValue().stream()
                    .map(cell -> activeMembers.get(cell.memberId())).filter(Objects::nonNull).findFirst().orElse(null);
            if (target == null) continue;
            inboxMessages.createEvent(schedule.getRestaurant(), actor,
                    employeeChangeMessage(schedule, entry.getValue()),
                    InboxEventSubtype.SCHEDULE_PUBLISHED_CHANGED,
                    changeMeta(schedule, batch, "employee:" + entry.getKey()), List.of(target), null);
            notifiedUserIds.add(entry.getKey());
        }
        return notifiedUserIds;
    }

    private void notifyOwnerIfNeeded(Schedule schedule,
                                     User actor,
                                     List<PublishedScheduleCellChange> changes,
                                     Set<Long> notifiedEmployeeUserIds) {
        Long ownerUserId = schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId();
        RestaurantMember ownerMember = schedule.getOwnerMember();
        if (ownerUserId != null && !ownerUserId.equals(actor.getId())
                && !notifiedEmployeeUserIds.contains(ownerUserId)
                && ownerMember != null && ownerMember.getUser() != null) {
            String content = ownerChangeMessage(schedule, changes);
            inboxMessages.createEvent(schedule.getRestaurant(), actor, content,
                    InboxEventSubtype.SCHEDULE_PUBLISHED_CHANGED_OWNER,
                    ownerChangeMeta(schedule, ownerUserId), List.of(ownerMember), null);
        }
    }

    private String ownerChangeMessage(Schedule schedule, List<PublishedScheduleCellChange> changes) {
        String prefix = "Опубликованный график «" + schedule.getTitle() + "» изменён другим менеджером.";
        if (changes.isEmpty()) {
            return prefix + " Изменены параметры графика.";
        }
        long employeesChanged = changes.stream().map(PublishedScheduleCellChange::memberId).distinct().count();
        return prefix + " Изменено сотрудников: " + employeesChanged + ", смен: " + changes.size() + ".";
    }

    private String safeDisplayName(User user) {
        return Optional.ofNullable(user)
                .map(User::getFullName)
                .map(String::trim)
                .orElse("");
    }

    private String employeeChangeMessage(Schedule schedule, List<PublishedScheduleCellChange> changes) {
        if (changes.size() > 3) {
            return "Ваш опубликованный график «" + schedule.getTitle() + "» изменён на " + changes.size() + " датах.";
        }
        String details = changes.stream().map(change -> change.day() + ": "
                + displayCellValue(change.oldValue()) + " → " + displayCellValue(change.newValue()))
                .collect(Collectors.joining("; "));
        return "Ваш опубликованный график «" + schedule.getTitle() + "» изменён. " + details;
    }

    private String displayCellValue(String value) {
        return value == null ? "Пусто" : value;
    }

    private String changeMeta(Schedule schedule, ScheduleChange batch, String recipient) {
        return "schedule:published-change:restaurant:" + schedule.getRestaurant().getId()
                + ":schedule:" + schedule.getId() + ":change:" + batch.getId() + ":" + recipient;
    }

    private String ownerChangeMeta(Schedule schedule, Long ownerUserId) {
        return "schedule:published-change:restaurant:" + schedule.getRestaurant().getId()
                + ":schedule:" + schedule.getId() + ":version:" + schedule.getVersion()
                + ":owner:" + ownerUserId;
    }

    private record PublishedScheduleCellChange(Long rowId, Long memberId, Long memberUserId,
                                               String memberDisplayName, LocalDate day,
                                               String oldValue, String newValue,
                                               ScheduleCellSource oldSource, ScheduleCellSource newSource) {}

    private void notifyAutoRejectedRequest(ScheduleShiftRequest request, Long actorUserId) {
        RestaurantMember fromMember = members.findById(request.getFromMemberId()).orElse(null);
        RestaurantMember toMember = members.findById(request.getToMemberId()).orElse(null);
        List<RestaurantMember> targets = deduplicateMembersByUserId(Stream.of(fromMember, toMember)
                .filter(Objects::nonNull)
                .filter(member -> member.getUser() != null)
                .filter(member -> !Objects.equals(member.getUser().getId(), actorUserId))
                .toList());
        if (targets.isEmpty()) return;
        var actorUser = users.findById(actorUserId).orElse(null);
        var sender = actorUser != null ? actorUser : targets.get(0).getUser();
        String content = "Заявка на замену/обмен сменами в графике «" + request.getSchedule().getTitle()
                + "» была отклонена автоматически, потому что график был изменён.";
        inboxMessages.createEvent(
                request.getSchedule().getRestaurant(),
                sender,
                content,
                InboxEventSubtype.SCHEDULE_DECISION,
                "scheduleRequest:auto-rejected:" + request.getId(),
                targets,
                null
        );
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

    private void notifyPreferenceCollectionStarted(Schedule schedule, Long actorUserId) {
        List<RestaurantMember> targets = deduplicateMembersByUserId(
                participations.findByScheduleIdOrderById(schedule.getId()).stream()
                        .map(ScheduleParticipation::getMember).toList()
        );
        targets = targets.stream()
                .filter(member -> !Objects.equals(member.getUser().getId(), actorUserId))
                .toList();
        if (targets.isEmpty()) {
            return;
        }
        var creator = users.findById(actorUserId).orElse(null);
        String content = "Оставьте пожелания по графику «" + schedule.getTitle()
                + "» за период " + schedule.getStartDate() + " — " + schedule.getEndDate() + ".";
        String meta = "schedulePreferences:start:restaurant:" + schedule.getRestaurant().getId()
                + ":schedule:" + schedule.getId()
                + ":deadline:" + schedule.getPreferenceDeadline();
        inboxMessages.createEvent(
                schedule.getRestaurant(),
                creator,
                content,
                InboxEventSubtype.SCHEDULE_PREFERENCES,
                meta,
                targets,
                schedule.getEndDate()
        );
    }

    private void notifySchedulePublished(Schedule schedule, Long actorUserId) {
        if (schedule == null || schedule.getRestaurant() == null) {
            return;
        }

        Set<Long> activeRowMemberIds = schedule.getRows().stream()
                .map(ScheduleRow::getMemberId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (activeRowMemberIds.isEmpty()) {
            return;
        }

        List<RestaurantMember> participatingMembers = participations.findByScheduleIdOrderById(schedule.getId()).stream()
                .map(ScheduleParticipation::getMember)
                .toList();
        Map<Long, RestaurantMember> targetsByUserId = new LinkedHashMap<>();
        for (RestaurantMember member : participatingMembers) {
            if (member == null || member.getUser() == null || member.getUser().getId() == null) {
                continue;
            }
            if (!activeRowMemberIds.contains(member.getId())) {
                continue;
            }
            if (Objects.equals(member.getUser().getId(), actorUserId)) {
                continue;
            }
            targetsByUserId.putIfAbsent(member.getUser().getId(), member);
        }
        List<RestaurantMember> targets = new ArrayList<>(targetsByUserId.values());
        if (targets.isEmpty()) {
            return;
        }

        var creator = users.findById(actorUserId).orElse(null);
        String content = "Опубликован график «" + schedule.getTitle()
                + "» на период " + schedule.getStartDate() + " — " + schedule.getEndDate();
        String meta = "schedule:published:restaurant:" + schedule.getRestaurant().getId()
                + ":schedule:" + schedule.getId();
        inboxMessages.createEvent(
                schedule.getRestaurant(),
                creator,
                content,
                InboxEventSubtype.SCHEDULE_DECISION,
                meta,
                targets,
                schedule.getEndDate()
        );
    }

    private record RequestCellRef(Long memberId, LocalDate day) {}

    private List<LocalDate> collectDays(LocalDate start, LocalDate end) {
        List<LocalDate> result = new ArrayList<>();
        LocalDate cursor = start;
        while (!cursor.isAfter(end)) {
            result.add(cursor);
            cursor = cursor.plusDays(1);
        }
        return result;
    }

    private ScheduleDto toDto(Schedule schedule, List<LocalDate> days) {
        Set<Long> activeScheduleMemberIds = resolveActiveScheduleMemberIds(schedule);
        List<ScheduleRow> visibleRows = schedule.getRows().stream()
                .filter(row -> row.getMemberId() != null && (activeScheduleMemberIds.contains(row.getMemberId())
                        || schedule.getStatus() == ScheduleStatus.PUBLISHED && row.isHistorical()))
                .toList();

        Map<String, String> cellValues = new HashMap<>();
        Map<String, ScheduleCellSource> cellSources = new HashMap<>();
        Map<String, ScheduleCellShiftDto> cellShifts = new HashMap<>();
        visibleRows.forEach(row -> row.getCells().forEach(cell -> {
            if (cell.getValue() == null || cell.getValue().isBlank()) {
                return;
            }
            String key = row.getMemberId() + ":" + cell.getDay();
            cellValues.put(key, cell.getValue());
            cellSources.put(key, cell.getSource() != null ? cell.getSource() : ScheduleCellSource.MANUAL);
            cell.structuredShift().ifPresent(interval -> cellShifts.put(key, ScheduleCellShiftDto.from(interval)));
        }));

        List<ScheduleDayDto> dayDtos = days.stream()
                .map(this::toDayDto)
                .toList();

        List<ScheduleRowDto> rowDtos = visibleRows.stream()
                .sorted(Comparator.comparing(ScheduleRow::isHistorical)
                        .thenComparing(row -> row.isHistorical() ? row.getDisplayName() : "", String.CASE_INSENSITIVE_ORDER)
                        .thenComparingInt(ScheduleRow::getSortOrder))
                .map(row -> new ScheduleRowDto(
                        row.getId(),
                        row.getMemberId(),
                        row.getDisplayName(),
                        row.getPositionId(),
                        row.getPositionName(),
                        row.isHistorical()
                ))
                .toList();

        ScheduleConfigDto config = new ScheduleConfigDto(
                schedule.getStartDate().toString(),
                schedule.getEndDate().toString(),
                new ArrayList<>(SchedulePositionIds.ids(schedule)),
                schedule.isShowFullName(),
                schedule.getShiftMode()
        );

        return new ScheduleDto(
                schedule.getId(),
                schedule.getVersion(),
                schedule.getTitle(),
                config,
                dayDtos,
                rowDtos,
                cellValues,
                cellSources,
                cellShifts,
                buildOwnerDto(schedule),
                buildCreatedByDto(schedule),
                scheduleAuditService.getRecentHistory(schedule, HISTORY_LIMIT),
                schedule.getStatus(),
                schedule.getPreferenceCollectionStartedAt(),
                schedule.getPreferenceDeadline(),
                schedule.getPreferenceClosedAt(),
                schedule.getPreferenceAppliedAt(),
                schedule.getPreferenceCollectionMode(),
                schedule.getPreferenceBuildTemplate() == null ? null : schedule.getPreferenceBuildTemplate().getId()
        );
    }

    private Set<Long> resolveActiveScheduleMemberIds(Schedule schedule) {
        return participations.findByScheduleIdOrderById(schedule.getId()).stream()
                .map(value -> value.getMember().getId())
                .collect(Collectors.toSet());
    }

    private ScheduleDayDto toDayDto(LocalDate day) {
        int dayOfWeek = day.getDayOfWeek().getValue();
        String weekday = WEEKDAY_LABELS[dayOfWeek == 7 ? 7 : dayOfWeek];
        return new ScheduleDayDto(day.toString(), weekday, Integer.toString(day.getDayOfMonth()));
    }

    private LocalDate parseDate(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException(field + " is required");
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            throw new BadRequestException("Invalid " + field + " format, expected yyyy-MM-dd");
        }
    }

    private Set<Position> resolvePositions(Long restaurantId, List<Long> requestedIds) {
        if (requestedIds == null || requestedIds.isEmpty()) {
            throw new BadRequestException("config.positionIds must contain at least one position");
        }
        if (requestedIds.stream().anyMatch(Objects::isNull)) {
            throw new BadRequestException("config.positionIds must not contain null");
        }

        Set<Long> distinctIds = new TreeSet<>(requestedIds);
        Map<Long, Position> foundById = positions.findAllById(distinctIds).stream()
                .filter(position -> Objects.equals(position.getRestaurant().getId(), restaurantId))
                .collect(Collectors.toMap(Position::getId, position -> position));
        if (foundById.size() != distinctIds.size()) {
            throw new BadRequestException("All config.positionIds must belong to the restaurant");
        }

        return distinctIds.stream()
                .map(foundById::get)
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    private String makeUniqueTitle(Long restaurantId, String baseTitle, String currentTitleToIgnore) {
        List<String> existing = new ArrayList<>(schedules.findTitlesByRestaurantId(restaurantId));
        if (currentTitleToIgnore != null) {
            existing.removeIf(title -> title.equals(currentTitleToIgnore));
        }
        if (!existing.contains(baseTitle)) {
            return baseTitle;
        }
        int counter = 2;
        while (true) {
            String candidate = baseTitle + " №" + counter;
            if (!existing.contains(candidate)) {
                return candidate;
            }
            counter++;
        }
    }

    private void applyOwnerAndCreator(Schedule schedule, Long restaurantId, Long actorUserId, Long ownerUserId) {
        RestaurantMember ownerMember = resolveOwner(restaurantId, actorUserId, ownerUserId);
        schedule.setOwnerMember(ownerMember);
        schedule.setOwnerUser(ownerMember.getUser());
        schedule.setCreatedByUser(users.findById(actorUserId)
                .orElseThrow(() -> new NotFoundException("Пользователь не найден: " + actorUserId)));
    }

    private RestaurantMember resolveOwner(Long restaurantId, Long actorUserId, Long ownerUserId) {
        if (ownerUserId != null) {
            RestaurantMember owner = members.findByUserIdAndRestaurantId(ownerUserId, restaurantId)
                    .orElseThrow(() -> new BadRequestException("ownerUserId must belong to the restaurant"));
            if (owner.getRole() != RestaurantRole.ADMIN && owner.getRole() != RestaurantRole.MANAGER) {
                throw new BadRequestException("owner must be MANAGER or ADMIN");
            }
            return owner;
        }
        RestaurantMember actorMember = members.findByUserIdAndRestaurantId(actorUserId, restaurantId)
                .orElseThrow(() -> new BadRequestException("ownerUserId is required for CREATOR without membership"));
        if (actorMember.getRole() != RestaurantRole.ADMIN && actorMember.getRole() != RestaurantRole.MANAGER) {
            throw new BadRequestException("ownerUserId is required for STAFF");
        }
        return actorMember;
    }

    private ScheduleOwnerDto buildOwnerDto(Schedule schedule) {
        RestaurantMember owner = schedule.getOwnerMember();
        if (owner == null) return null;
        return new ScheduleOwnerDto(
                owner.getUser() != null ? owner.getUser().getId() : null,
                owner.getId(),
                owner.getUser() != null ? owner.getUser().getFullName() : null,
                owner.getRole(),
                owner.getPosition() != null ? owner.getPosition().getName() : null
        );
    }

    private ScheduleCreatedByDto buildCreatedByDto(Schedule schedule) {
        if (schedule.getCreatedByUser() == null) return null;
        return new ScheduleCreatedByDto(
                schedule.getCreatedByUser().getId(),
                schedule.getCreatedByUser().getFullName()
        );
    }
}
