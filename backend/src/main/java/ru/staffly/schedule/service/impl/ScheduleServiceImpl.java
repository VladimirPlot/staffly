package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.model.ScheduleCell;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleShiftMode;
import ru.staffly.schedule.model.ScheduleShiftRequest;
import ru.staffly.schedule.model.ScheduleShiftRequestType;
import ru.staffly.schedule.model.ScheduleShiftRequestStatus;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.repository.ScheduleShiftRequestRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAuditService;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.repository.UserRepository;

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
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final ScheduleShiftRequestRepository shiftRequests;
    private final RestaurantMemberRepository members;
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleAuditService scheduleAuditService;
    private final UserRepository users;
    private final InboxMessageService inboxMessages;

    @Override
    public ScheduleDto create(Long restaurantId, Long userId, SaveScheduleRequest request) {
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

        List<Long> positionIds = config.positionIds() != null
                ? config.positionIds()
                : List.of();
        if (positionIds.isEmpty()) {
            throw new BadRequestException("config.positionIds must contain at least one position");
        }
        validatePositions(restaurantId, positionIds);

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
                .showFullName(config.showFullName())
                .positionIds(new ArrayList<>(positionIds))
                .build();

        applyOwnerAndCreator(schedule, restaurantId, userId, request.ownerUserId());
        List<ScheduleRow> rowEntities = buildRows(schedule, request.rows(), request.cellValues(), days);
        schedule.setRows(rowEntities);

        Schedule saved = schedules.save(schedule);
        scheduleAuditService.record(saved, userId, ScheduleAuditAction.CREATED, "График создан");
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
        final Long memberId = membership.map(RestaurantMember::getId).orElse(null);

        return schedules.findByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream()
                .filter(schedule -> scheduleAccessService.canViewSchedule(userId, schedule))
                .map(s -> new ScheduleSummaryDto(
                        s.getId(),
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
                        s.getPositionIds(),
                        buildOwnerDto(s)
                ))
                .toList();
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

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));

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

        List<Long> positionIds = config.positionIds() != null
                ? config.positionIds()
                : List.of();
        if (positionIds.isEmpty()) {
            throw new BadRequestException("config.positionIds must contain at least one position");
        }
        validatePositions(restaurantId, positionIds);

        List<LocalDate> days = collectDays(startDate, endDate);

        String baseTitle = Optional.ofNullable(request.title()).map(String::trim).filter(s -> !s.isEmpty())
                .orElse("График");
        String title = makeUniqueTitle(restaurantId, baseTitle, schedule.getTitle());

        schedule.setTitle(title);
        schedule.setStartDate(startDate);
        schedule.setEndDate(endDate);
        schedule.setShiftMode(shiftMode);
        schedule.setShowFullName(config.showFullName());
        schedule.setPositionIds(new ArrayList<>(positionIds));

        List<ScheduleRowPayload> safeRows = request.rows() != null ? request.rows() : List.of();
        Map<String, String> newValues = request.cellValues() != null ? request.cellValues() : Map.of();
        Map<Long, RestaurantMember> memberMap = validateAndMapMembers(schedule, safeRows);
        Map<String, String> oldValueMap = buildCurrentValueMap(schedule);
        Map<String, String> newValueMap = buildRequestedValueMap(newValues, days, memberMap.keySet());
        autoRejectAffectedPendingRequests(schedule, userId, oldValueMap, newValueMap, memberMap.keySet(), new HashSet<>(days));
        applyRowsDiff(schedule, safeRows, newValues, days, memberMap);

        Schedule saved = schedules.save(schedule);
        scheduleAuditService.record(saved, userId, ScheduleAuditAction.UPDATED, "График изменён");
        saved.getRows().forEach(row -> row.getCells().size());
        return toDto(saved, days);
    }

    @Override
    public void delete(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertRestaurantUnlocked(userId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(userId, restaurantId);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));

        scheduleAuditService.record(schedule, userId, ScheduleAuditAction.DELETED, "График удалён");
        schedules.delete(schedule);
    }

    private List<ScheduleRow> buildRows(Schedule schedule,
                                        List<ScheduleRowPayload> rows,
                                        Map<String, String> cellValues,
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
            if (!schedule.getPositionIds().contains(member.getPosition().getId())) {
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

            List<ScheduleCell> cells = buildCells(entity, member.getId(), values, days);
            entity.setCells(cells);
            entities.add(entity);
        }
        return entities;
    }

    private List<ScheduleCell> buildCells(ScheduleRow row,
                                          Long memberId,
                                          Map<String, String> values,
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
                    .build();
            cells.add(cell);
        }
        return cells;
    }

    private Map<Long, RestaurantMember> validateAndMapMembers(Schedule schedule, List<ScheduleRowPayload> rows) {
        Map<Long, RestaurantMember> memberMap = new LinkedHashMap<>();
        for (ScheduleRowPayload row : rows) {
            if (row.memberId() == null) {
                throw new BadRequestException("memberId is required for each row");
            }
            RestaurantMember member = members.findById(row.memberId())
                    .orElseThrow(() -> new NotFoundException("Сотрудник не найден: " + row.memberId()));
            if (!Objects.equals(member.getRestaurant().getId(), schedule.getRestaurant().getId())) {
                throw new ForbiddenException("Нельзя добавить сотрудника из другого ресторана");
            }
            if (member.getUser() == null) throw new BadRequestException("У сотрудника нет пользователя");
            if (member.getPosition() == null) throw new BadRequestException("У сотрудника не задана должность");
            if (!schedule.getPositionIds().contains(member.getPosition().getId())) {
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
        List<ScheduleShiftRequest> pending = shiftRequests.findByScheduleIdAndStatus(schedule.getId(), ScheduleShiftRequestStatus.PENDING_MANAGER);
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
        if (!newMemberIds.contains(memberId) || !newPeriodDays.contains(day)) {
            return true;
        }
        String key = memberId + ":" + day;
        return !Objects.equals(normalizeCellValue(oldMap.get(key)), normalizeCellValue(newMap.get(key)));
    }

    private void applyRowsDiff(Schedule schedule, List<ScheduleRowPayload> rows, Map<String, String> values, List<LocalDate> days, Map<Long, RestaurantMember> memberMap) {
        Map<Long, ScheduleRow> existingByMemberId = schedule.getRows().stream()
                .collect(Collectors.toMap(ScheduleRow::getMemberId, r -> r, (left, right) -> left));
        Set<Long> requestedIds = rows.stream().map(ScheduleRowPayload::memberId).collect(Collectors.toCollection(LinkedHashSet::new));

        List<ScheduleRow> rowsToRemove = schedule.getRows().stream()
                .filter(row -> !requestedIds.contains(row.getMemberId()))
                .toList();
        for (ScheduleRow row : rowsToRemove) {
            if (row.getId() != null && shiftRequests.existsByFromRowIdOrToRowId(row.getId())) {
                throw new BadRequestException("Нельзя удалить сотрудника из графика: по его строке есть история заявок на смену");
            }
            schedule.getRows().remove(row);
        }
        int index = 0;
        for (Long memberId : requestedIds) {
            RestaurantMember member = memberMap.get(memberId);
            ScheduleRow row = existingByMemberId.get(memberId);
            if (row == null) {
                row = ScheduleRow.builder().schedule(schedule).memberId(memberId).build();
                schedule.getRows().add(row);
            }
            row.setDisplayName(Optional.ofNullable(member.getUser().getFullName()).orElse(""));
            row.setPositionId(member.getPosition().getId());
            row.setPositionName(member.getPosition().getName());
            row.setSortOrder(index++);
            reconcileCells(row, memberId, values, days);
        }
    }

    private void reconcileCells(ScheduleRow row, Long memberId, Map<String, String> values, List<LocalDate> days) {
        Set<LocalDate> validDays = new HashSet<>(days);
        row.getCells().removeIf(cell -> !validDays.contains(cell.getDay()));
        Map<LocalDate, ScheduleCell> byDay = row.getCells().stream().collect(Collectors.toMap(ScheduleCell::getDay, c -> c, (a, b) -> a));
        for (LocalDate day : days) {
            String normalized = normalizeCellValue(values.get(memberId + ":" + day));
            ScheduleCell existing = byDay.get(day);
            if (normalized == null) {
                if (existing != null) {
                    row.getCells().remove(existing);
                }
                continue;
            }
            if (existing == null || !row.getCells().contains(existing)) {
                row.getCells().add(ScheduleCell.builder().row(row).day(day).value(normalized).build());
            } else {
                existing.setValue(normalized);
            }
        }
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
        Map<String, String> cellValues = schedule.getRows().stream()
                .flatMap(row -> row.getCells().stream()
                        .map(cell -> Map.entry(row.getMemberId() + ":" + cell.getDay(), cell.getValue())))
                .collect(Collectors.toMap(Map.Entry::getKey, Map.Entry::getValue));

        List<ScheduleDayDto> dayDtos = days.stream()
                .map(this::toDayDto)
                .toList();

        List<ScheduleRowDto> rowDtos = schedule.getRows().stream()
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
                new ArrayList<>(schedule.getPositionIds()),
                schedule.isShowFullName(),
                schedule.getShiftMode()
        );

        return new ScheduleDto(
                schedule.getId(),
                schedule.getTitle(),
                config,
                dayDtos,
                rowDtos,
                cellValues,
                buildOwnerDto(schedule),
                buildCreatedByDto(schedule),
                scheduleAuditService.getRecentHistory(schedule, HISTORY_LIMIT)
        );
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

    private void validatePositions(Long restaurantId, List<Long> positionIds) {
        if (positionIds.isEmpty()) {
            return;
        }
        Set<Long> allowed = positions.findByRestaurantId(restaurantId).stream()
                .map(p -> p.getId())
                .collect(Collectors.toSet());
        for (Long id : positionIds) {
            if (!allowed.contains(id)) {
                throw new BadRequestException("Position " + id + " does not belong to the restaurant");
            }
        }
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
