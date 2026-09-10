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
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAuditService;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

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
    private final RestaurantMemberRepository members;
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleAuditService scheduleAuditService;
    private final UserRepository users;
    private final InboxMessageService inboxMessages;

    @Override
    public ScheduleDto create(Long restaurantId, Long userId, SaveScheduleRequest request) {
        return createWithStatus(restaurantId, userId, request, ScheduleStatus.PUBLISHED, "График создан");
    }

    @Override
    public ScheduleDto createDraft(Long restaurantId, Long userId, SaveScheduleRequest request) {
        return createWithStatus(restaurantId, userId, request, ScheduleStatus.DRAFT, "Черновик графика создан");
    }

    private ScheduleDto createWithStatus(Long restaurantId,
                                         Long userId,
                                         SaveScheduleRequest request,
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
        List<ScheduleRow> rowEntities = buildRows(
                schedule, request.rows(), request.cellValues(), request.cellSources(), days
        );
        schedule.setRows(rowEntities);

        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(saved, userId, ScheduleAuditAction.CREATED, auditDetails);
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
        } else if (currentMember.getPosition() != null && currentMember.getPosition().getId() != null) {
            visibleCandidates = schedules.findByRestaurantIdAndPositionId(
                    restaurantId, currentMember.getPosition().getId()
            );
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
        if (currentMember.getPosition() == null || currentMember.getPosition().getId() == null) {
            return null;
        }
        List<Long> positionIds = SchedulePositionIds.ids(schedule);
        if (positionIds == null || !positionIds.contains(currentMember.getPosition().getId())) {
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
        List<Long> positionIds = SchedulePositionIds.ids(schedule);
        if (positionIds == null || positionIds.isEmpty()) {
            return new PreferenceProgressSummary(0, 0);
        }

        List<RestaurantMember> participants = members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                schedule.getRestaurant().getId(),
                positionIds
        );
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
    public ScheduleDto update(Long restaurantId, Long scheduleId, Long userId, SaveScheduleRequest request) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, request.version());
        assertCanUpdateScheduleContent(schedule);

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

        schedule.setTitle(title);
        schedule.setStartDate(startDate);
        schedule.setEndDate(endDate);
        schedule.setShiftMode(shiftMode);
        schedule.setShowFullName(config.showFullName());
        schedule.setPositions(schedulePositions);

        List<ScheduleRowPayload> safeRows = request.rows() != null ? request.rows() : List.of();
        Map<String, String> newValues = request.cellValues() != null ? request.cellValues() : Map.of();
        Map<Long, RestaurantMember> memberMap = validateAndMapMembers(schedule, safeRows);
        Map<String, String> oldValueMap = buildCurrentValueMap(schedule);
        Map<String, String> newValueMap = buildRequestedValueMap(newValues, days, memberMap.keySet());
        autoRejectAffectedPendingRequests(
                schedule, userId, oldValueMap, newValueMap, memberMap.keySet(), new HashSet<>(days)
        );
        applyRowsDiff(schedule, newValues, request.cellSources(), days, memberMap);

        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(saved, userId, ScheduleAuditAction.UPDATED, "График изменён");
        saved.getRows().forEach(row -> row.getCells().size());
        return toDto(saved, days);
    }

    @Override
    @Transactional(readOnly = true)
    public List<AddableScheduleMemberDto> getAddableMembers(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertCanUpdateScheduleContent(schedule);

        Set<Long> existingMemberIds = schedule.getRows().stream()
                .map(ScheduleRow::getMemberId)
                .filter(Objects::nonNull)
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

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);
        assertCanUpdateScheduleContent(schedule);

        RestaurantMember member = members.findById(memberId)
                .filter(candidate -> Objects.equals(candidate.getRestaurant().getId(), restaurantId))
                .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + memberId));
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
        schedule.getRows().add(ScheduleRow.builder()
                .schedule(schedule)
                .memberId(member.getId())
                .displayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""))
                .positionId(member.getPosition().getId())
                .positionName(member.getPosition().getName())
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

        // Global two-aggregate lock order is Schedule -> ScheduleBuildTemplate.
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

        ScheduleBuildTemplate preferenceBuildTemplate = resolvePreferenceBuildTemplateForUpdate(
                restaurantId,
                schedule,
                request == null ? null : request.buildTemplateId()
        );

        replacePreferenceShiftOptionSnapshot(schedule, preferenceBuildTemplate);
        schedule.setStatus(ScheduleStatus.COLLECTING_PREFERENCES);
        schedule.setPreferenceBuildTemplate(preferenceBuildTemplate);
        schedule.setPreferenceCollectionStartedAt(now);
        schedule.setPreferenceDeadline(deadline);
        schedule.setPreferenceClosedAt(null);
        schedule.setPreferenceAppliedAt(null);
        schedule.setPreferenceAllSubmittedNotifiedAt(null);

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

    private ScheduleBuildTemplate resolvePreferenceBuildTemplateForUpdate(Long restaurantId, Schedule schedule, Long buildTemplateId) {
        if (buildTemplateId == null) {
            return null;
        }
        ScheduleBuildTemplate template = buildTemplates.findForUpdateByIdAndRestaurantId(buildTemplateId, restaurantId)
                .orElseThrow(() -> new BadRequestException("Активный шаблон сборки не найден"));
        if (!template.isActive()) {
            throw new BadRequestException("Активный шаблон сборки не найден");
        }
        initializeBuildTemplateCollections(template);
        List<Long> schedulePositionIds = SchedulePositionIds.ids(schedule);
        boolean hasSchedulePositionConfig = template.getPositionConfigs().stream()
                .flatMap(config -> buildConfigPositionIds(config).stream())
                .anyMatch(schedulePositionIds::contains);
        if (!hasSchedulePositionConfig) {
            throw new BadRequestException("Шаблон сборки не содержит настроек для позиций графика");
        }
        return template;
    }

    private void replacePreferenceShiftOptionSnapshot(Schedule schedule, ScheduleBuildTemplate template) {
        schedule.getPreferenceShiftOptionSnapshots().clear();
        if (template == null) {
            return;
        }
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

    private List<Long> buildConfigPositionIds(ScheduleBuildPositionConfig config) {
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

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
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

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
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

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        assertExpectedVersion(schedule, expectedVersion);

        scheduleAuditService.record(schedule, userId, ScheduleAuditAction.DELETED, "График удалён");
        schedules.delete(schedule);
    }

    private List<ScheduleRow> buildRows(Schedule schedule,
                                        List<ScheduleRowPayload> rows,
                                        Map<String, String> cellValues,
                                        Map<String, ScheduleCellSource> cellSources,
                                        List<LocalDate> days) {
        List<ScheduleRowPayload> safeRows = rows != null ? rows : List.of();
        Map<String, String> values = cellValues != null ? cellValues : Map.of();

        List<ScheduleRow> entities = new ArrayList<>(safeRows.size());
        Set<Long> seenMemberIds = new HashSet<>();
        int index = 0;
        for (ScheduleRowPayload row : safeRows) {
            if (row.memberId() == null) {
                throw new BadRequestException("memberId is required for each row");
            }
            RestaurantMember member = members.findById(row.memberId())
                    .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + row.memberId()));
            if (!Objects.equals(member.getRestaurant().getId(), schedule.getRestaurant().getId())) {
                throw new ForbiddenException("Нельзя добавить сотрудника из другого ресторана");
            }
            if (member.getUser() == null) { throw new BadRequestException("У сотрудника нет пользователя"); }
            if (member.getPosition() == null) { throw new BadRequestException("У сотрудника не задана должность"); }
            if (!SchedulePositionIds.ids(schedule).contains(member.getPosition().getId())) {
                throw new BadRequestException("Должность сотрудника не входит в позиции графика");
            }
            if (!seenMemberIds.add(member.getId())) { throw new BadRequestException("Один и тот же сотрудник не может быть добавлен дважды"); }
            ScheduleRow entity = ScheduleRow.builder()
                    .schedule(schedule)
                    .memberId(member.getId())
                    .displayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""))
                    .positionId(member.getPosition().getId())
                    .positionName(member.getPosition().getName())
                    .sortOrder(index++)
                    .build();

            List<ScheduleCell> cells = buildCells(entity, member.getId(), values, cellSources, days);
            entity.setCells(cells);
            entities.add(entity);
        }
        return entities;
    }

    private List<ScheduleCell> buildCells(ScheduleRow row,
                                          Long memberId,
                                          Map<String, String> values,
                                          Map<String, ScheduleCellSource> sources,
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
                    .source(resolveManualSaveSource(sources, key))
                    .build();
            cells.add(cell);
        }
        return cells;
    }

    private Map<Long, RestaurantMember> validateAndMapMembers(Schedule schedule, List<ScheduleRowPayload> rows) {
        Map<Long, RestaurantMember> memberMap = new LinkedHashMap<>();
        Set<Long> historicalMemberIds = schedule.getRows().stream()
                .map(ScheduleRow::getMemberId)
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        for (ScheduleRowPayload row : rows) {
            if (row.memberId() == null) {
                throw new BadRequestException("memberId is required for each row");
            }
            RestaurantMember member = members.findById(row.memberId())
                    .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + row.memberId()));
            if (!Objects.equals(member.getRestaurant().getId(), schedule.getRestaurant().getId())) {
                throw new ForbiddenException("Нельзя добавить сотрудника из другого ресторана");
            }
            boolean currentlyEligible = member.getUser() != null
                    && member.getPosition() != null
                    && SchedulePositionIds.ids(schedule).contains(member.getPosition().getId());
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
                               Map<String, ScheduleCellSource> sources,
                               List<LocalDate> days,
                               Map<Long, RestaurantMember> memberMap) {
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
                row.setPositionId(member.getPosition().getId());
                row.setPositionName(member.getPosition().getName());
            }
            activeRows.add(row);
            row.setDisplayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""));
            row.setSortOrder(index++);
            reconcileCells(row, memberId, values, sources, days);
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
                                Map<String, ScheduleCellSource> sources,
                                List<LocalDate> days) {
        Set<LocalDate> validDays = new HashSet<>(days);
        row.getCells().removeIf(cell -> !validDays.contains(cell.getDay()));
        Map<LocalDate, ScheduleCell> byDay = row.getCells().stream()
                .collect(Collectors.toMap(ScheduleCell::getDay, c -> c, (a, b) -> a));
        for (LocalDate day : days) {
            String key = memberId + ":" + day;
            String normalized = normalizeCellValue(values.get(key));
            ScheduleCellSource source = resolveManualSaveSource(sources, key);
            ScheduleCell existing = byDay.get(day);
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
        }
    }

    private ScheduleCellSource resolveManualSaveSource(Map<String, ScheduleCellSource> sources, String key) {
        ScheduleCellSource source = sources == null ? null : sources.get(key);
        if (source == ScheduleCellSource.PREFERENCE_HINT) {
            return ScheduleCellSource.PREFERENCE_HINT;
        }
        return ScheduleCellSource.MANUAL;
    }

    private String normalizeCellValue(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private void notifyAutoRejectedRequest(ScheduleShiftRequest request, Long actorUserId) {
        RestaurantMember fromMember = members.findById(request.getFromMemberId()).orElse(null);
        RestaurantMember toMember = members.findById(request.getToMemberId()).orElse(null);
        if (fromMember == null || toMember == null) return;
        var actorUser = users.findById(actorUserId).orElse(null);
        var sender = actorUser != null ? actorUser : (fromMember.getUser() != null ? fromMember.getUser() : toMember.getUser());
        String content = "Заявка на замену/обмен сменами в графике «" + request.getSchedule().getTitle()
                + "» была отклонена автоматически, потому что график был изменён.";
        inboxMessages.createEvent(
                request.getSchedule().getRestaurant(),
                sender,
                content,
                InboxEventSubtype.SCHEDULE_DECISION,
                "scheduleRequest:" + request.getId(),
                new ArrayList<>(Set.of(fromMember, toMember)),
                Optional.ofNullable(request.getSchedule().getEndDate()).orElse(request.getSchedule().getStartDate())
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
        List<Long> positionIds = SchedulePositionIds.ids(schedule);
        if (positionIds.isEmpty()) {
            return;
        }
        List<RestaurantMember> targets = deduplicateMembersByUserId(
                members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                        schedule.getRestaurant().getId(),
                        positionIds
                )
        );
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

        List<Long> positionIds = SchedulePositionIds.ids(schedule);
        if (positionIds.isEmpty()) {
            return;
        }

        List<RestaurantMember> membersWithSchedulePositions = members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                schedule.getRestaurant().getId(),
                positionIds
        );
        Map<Long, RestaurantMember> targetsByUserId = new LinkedHashMap<>();
        for (RestaurantMember member : membersWithSchedulePositions) {
            if (member == null || member.getUser() == null || member.getUser().getId() == null) {
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
                .filter(row -> row.getMemberId() != null && activeScheduleMemberIds.contains(row.getMemberId()))
                .toList();

        Map<String, String> cellValues = new HashMap<>();
        Map<String, ScheduleCellSource> cellSources = new HashMap<>();
        visibleRows.forEach(row -> row.getCells().forEach(cell -> {
            if (cell.getValue() == null || cell.getValue().isBlank()) {
                return;
            }
            String key = row.getMemberId() + ":" + cell.getDay();
            cellValues.put(key, cell.getValue());
            cellSources.put(key, cell.getSource() != null ? cell.getSource() : ScheduleCellSource.MANUAL);
        }));

        List<ScheduleDayDto> dayDtos = days.stream()
                .map(this::toDayDto)
                .toList();

        List<ScheduleRowDto> rowDtos = visibleRows.stream()
                .sorted(Comparator.comparingInt(ScheduleRow::getSortOrder))
                .map(row -> new ScheduleRowDto(
                        row.getId(),
                        row.getMemberId(),
                        row.getDisplayName(),
                        row.getPositionId(),
                        row.getPositionName()
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
                buildOwnerDto(schedule),
                buildCreatedByDto(schedule),
                scheduleAuditService.getRecentHistory(schedule, HISTORY_LIMIT),
                schedule.getStatus(),
                schedule.getPreferenceCollectionStartedAt(),
                schedule.getPreferenceDeadline(),
                schedule.getPreferenceClosedAt(),
                schedule.getPreferenceAppliedAt(),
                schedule.getPreferenceBuildTemplate() == null ? null : schedule.getPreferenceBuildTemplate().getId()
        );
    }

    private Set<Long> resolveActiveScheduleMemberIds(Schedule schedule) {
        if (schedule.getRestaurant() == null || schedule.getRestaurant().getId() == null) {
            return Set.of();
        }
        List<Long> positionIds = SchedulePositionIds.ids(schedule);
        if (positionIds.isEmpty()) {
            return Set.of();
        }
        return members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                        schedule.getRestaurant().getId(),
                        positionIds
                ).stream()
                .map(RestaurantMember::getId)
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
