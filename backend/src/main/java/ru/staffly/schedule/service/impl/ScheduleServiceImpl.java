package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleCell;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleShiftMode;
import ru.staffly.schedule.model.ScheduleShiftRequestStatus;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.repository.ScheduleShiftRequestRepository;
import ru.staffly.schedule.service.ScheduleService;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleServiceImpl implements ScheduleService {

    private static final String[] WEEKDAY_LABELS = {"", "пн", "вт", "ср", "чт", "пт", "сб", "вс"};

    private final ScheduleRepository schedules;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final ScheduleShiftRequestRepository shiftRequests;
    private final RestaurantMemberRepository members;
    private final SecurityService securityService;

    @Override
    public ScheduleDto create(Long restaurantId, Long userId, SaveScheduleRequest request) {
        securityService.assertAtLeastManager(userId, restaurantId);

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

        List<ScheduleRow> rowEntities = buildRows(schedule, request.rows(), request.cellValues(), days);
        schedule.setRows(rowEntities);

        Schedule saved = schedules.save(schedule);
        return toDto(saved, days);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ScheduleSummaryDto> list(Long restaurantId, Long userId) {
        securityService.assertMember(userId, restaurantId);

        final boolean canManage = securityService.hasAtLeastManager(userId, restaurantId);
        Optional<RestaurantMember> membership = !canManage
                ? members.findByUserIdAndRestaurantId(userId, restaurantId)
                : Optional.<RestaurantMember>empty();

        final Long memberId = membership.map(m -> m.getId()).orElse(null);
        final Long positionId = membership
                .map(m -> m.getPosition())
                .map(p -> p.getId())
                .orElse(null);

        return schedules.findByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream()
                .filter(schedule -> canManage || (positionId != null && schedule.getPositionIds().contains(positionId)))
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
                        s.getPositionIds()
                ))
                .toList();
    }

    @Override
    @Transactional(readOnly = true)
    public ScheduleDto get(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertMember(userId, restaurantId);
        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        schedule.getRows().forEach(row -> row.getCells().size());
        List<LocalDate> days = collectDays(schedule.getStartDate(), schedule.getEndDate());
        return toDto(schedule, days);
    }

    @Override
    public ScheduleDto update(Long restaurantId, Long scheduleId, Long userId, SaveScheduleRequest request) {
        securityService.assertAtLeastManager(userId, restaurantId);

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

        schedule.getRows().clear();
        List<ScheduleRow> rowEntities = buildRows(schedule, request.rows(), request.cellValues(), days);
        schedule.getRows().addAll(rowEntities);

        Schedule saved = schedules.save(schedule);
        saved.getRows().forEach(row -> row.getCells().size());
        return toDto(saved, days);
    }

    @Override
    public void delete(Long restaurantId, Long scheduleId, Long userId) {
        securityService.assertAtLeastManager(userId, restaurantId);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));

        schedules.delete(schedule);
    }

    private List<ScheduleRow> buildRows(Schedule schedule,
                                        List<ScheduleRowPayload> rows,
                                        Map<String, String> cellValues,
                                        List<LocalDate> days) {
        List<ScheduleRowPayload> safeRows = rows != null ? rows : List.of();
        Map<String, String> values = cellValues != null ? cellValues : Map.of();

        List<ScheduleRow> entities = new ArrayList<>(safeRows.size());
        int index = 0;
        for (ScheduleRowPayload row : safeRows) {
            if (row.memberId() == null) {
                throw new BadRequestException("memberId is required for each row");
            }
            ScheduleRow entity = ScheduleRow.builder()
                    .schedule(schedule)
                    .memberId(row.memberId())
                    .displayName(Optional.ofNullable(row.displayName()).orElse(""))
                    .positionId(row.positionId())
                    .positionName(row.positionName())
                    .sortOrder(index++)
                    .build();

            List<ScheduleCell> cells = buildCells(entity, row.memberId(), values, days);
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
                cellValues
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
}