package ru.staffly.master_schedule.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.master_schedule.dto.*;
import ru.staffly.master_schedule.model.*;
import ru.staffly.master_schedule.repository.MasterScheduleCellRepository;
import ru.staffly.master_schedule.repository.MasterScheduleRepository;
import ru.staffly.master_schedule.repository.MasterScheduleRowRepository;
import ru.staffly.master_schedule.util.MasterScheduleValueParser;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.text.Collator;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class MasterScheduleService {

    private static final long MAX_PERIOD_DAYS = 93;

    private final MasterScheduleRepository schedules;
    private final MasterScheduleRowRepository rows;
    private final MasterScheduleCellRepository cells;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final SecurityService security;
    private final MasterScheduleValueParser parser = new MasterScheduleValueParser();

    @Transactional
    public List<MasterScheduleSummaryDto> list(Long restaurantId, Long userId) {
        security.assertAtLeastManager(userId, restaurantId);
        return schedules.findByRestaurantIdAndDeletedAtIsNull(restaurantId)
                .stream()
                .sorted(Comparator.comparing(MasterSchedule::getPeriodStart))
                .map(this::toSummaryDto)
                .toList();
    }

    @Transactional
    public MasterScheduleDto create(Long restaurantId, Long userId, MasterScheduleCreateRequest request) {
        security.assertAtLeastManager(userId, restaurantId);
        validatePeriod(request.periodStart(), request.periodEnd());

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        List<Position> activePositions = positions.findByRestaurantIdAndActiveTrue(restaurantId)
                .stream()
                .sorted(positionComparator())
                .toList();

        MasterSchedule schedule = MasterSchedule.builder()
                .restaurant(restaurant)
                .name(request.name().trim())
                .periodStart(request.periodStart())
                .periodEnd(request.periodEnd())
                .mode(request.mode())
                .plannedRevenue(request.plannedRevenue())
                .build();
        schedule = schedules.save(schedule);
        List<MasterScheduleRow> createdRows = createRowsForPositions(schedule, activePositions);
        return toDto(schedule, createdRows, List.of());
    }

    @Transactional
    public MasterScheduleDto get(Long scheduleId, Long userId) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        List<MasterScheduleRow> scheduleRows = rows.findByScheduleId(scheduleId);
        List<MasterScheduleCell> scheduleCells = cells.findByRowScheduleId(scheduleId);
        return toDto(schedule, scheduleRows, scheduleCells);
    }

    @Transactional
    public MasterScheduleDto update(Long scheduleId, Long userId, MasterScheduleUpdateRequest request) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        if (request.periodStart() != null || request.periodEnd() != null) {
            LocalDate start = request.periodStart() != null ? request.periodStart() : schedule.getPeriodStart();
            LocalDate end = request.periodEnd() != null ? request.periodEnd() : schedule.getPeriodEnd();
            validatePeriod(start, end);
            schedule.setPeriodStart(start);
            schedule.setPeriodEnd(end);
        }
        if (request.name() != null) {
            String trimmed = request.name().trim();
            if (trimmed.isEmpty()) {
                throw new ConflictException("Schedule name is required");
            }
            schedule.setName(trimmed);
        }
        if (request.mode() != null) {
            schedule.setMode(request.mode());
        }
        schedule.setPlannedRevenue(request.plannedRevenue());
        schedules.save(schedule);
        List<MasterScheduleRow> scheduleRows = rows.findByScheduleId(scheduleId);
        List<MasterScheduleCell> scheduleCells = cells.findByRowScheduleId(scheduleId);
        return toDto(schedule, scheduleRows, scheduleCells);
    }

    @Transactional
    public void delete(Long scheduleId, Long userId) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        schedule.markDeleted();
        schedules.save(schedule);
    }

    @Transactional
    public MasterScheduleRowDto createRow(Long scheduleId, Long userId, MasterScheduleRowCreateRequest request) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        Position position = positions.findById(request.positionId())
                .orElseThrow(() -> new NotFoundException("Position not found: " + request.positionId()));
        if (!Objects.equals(position.getRestaurant().getId(), schedule.getRestaurant().getId())) {
            throw new NotFoundException("Position not found in this restaurant");
        }

        List<MasterScheduleRow> scheduleRows = rows.findByScheduleId(scheduleId);

        boolean exists = scheduleRows.stream()
                .anyMatch(row -> Objects.equals(row.getPosition().getId(), position.getId()));

        if (schedule.getMode() == MasterScheduleMode.COMPACT && exists) {
            throw new ConflictException("Compact mode allows only one row per position");
        }

        int nextIndex = scheduleRows.stream()
                .filter(r -> Objects.equals(r.getPosition().getId(), position.getId()))
                .mapToInt(MasterScheduleRow::getRowIndex)
                .max()
                .orElse(-1) + 1;

        MasterScheduleRow row = MasterScheduleRow.builder()
                .schedule(schedule)
                .position(position)
                .rowIndex(nextIndex)
                .salaryHandling(request.salaryHandling() != null ? request.salaryHandling() : SalaryHandling.PRORATE)
                .rateOverride(request.rateOverride())
                .amountOverride(request.amountOverride())
                .build();
        row = rows.save(row);
        return toRowDto(row);
    }

    @Transactional
    public MasterScheduleRowDto updateRow(Long rowId, Long userId, MasterScheduleRowUpdateRequest request) {
        MasterScheduleRow row = rows.findById(rowId)
                .orElseThrow(() -> new NotFoundException("Row not found: " + rowId));
        MasterSchedule schedule = row.getSchedule();
        security.assertAtLeastManager(userId, schedule.getRestaurant().getId());
        if (request.salaryHandling() != null) {
            row.setSalaryHandling(request.salaryHandling());
        }
        row.setRateOverride(request.rateOverride());
        row.setAmountOverride(request.amountOverride());
        row = rows.save(row);
        return toRowDto(row);
    }

    @Transactional
    public void deleteRow(Long rowId, Long userId) {
        MasterScheduleRow row = rows.findById(rowId)
                .orElseThrow(() -> new NotFoundException("Row not found: " + rowId));
        MasterSchedule schedule = row.getSchedule();
        security.assertAtLeastManager(userId, schedule.getRestaurant().getId());
        rows.delete(row);
    }

    @Transactional
    public List<MasterScheduleCellDto> batchUpdateCells(Long scheduleId, Long userId, MasterScheduleCellBatchRequest request) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        Map<Long, MasterScheduleRow> rowMap = rows.findByScheduleId(scheduleId)
                .stream()
                .collect(Collectors.toMap(MasterScheduleRow::getId, row -> row));

        List<MasterScheduleCellDto> result = request.items().stream()
                .map(item -> updateCell(schedule, rowMap, item))
                .filter(Objects::nonNull)
                .toList();
        return result;
    }

    @Transactional
    public void copyDay(Long scheduleId, Long userId, MasterScheduleCopyDayRequest request) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        ensureDateInSchedule(schedule, request.sourceDate());
        ensureDateInSchedule(schedule, request.targetDate());

        List<MasterScheduleCell> sourceCells = cells.findByRowScheduleIdAndWorkDate(scheduleId, request.sourceDate());
        for (MasterScheduleCell source : sourceCells) {
            upsertCell(source.getRow(), request.targetDate(), source.getValueRaw());
        }
    }

    @Transactional
    public void copyWeek(Long scheduleId, Long userId, MasterScheduleCopyWeekRequest request) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        LocalDate sourceStart = request.sourceWeekStart();
        LocalDate targetStart = request.targetWeekStart();
        for (int i = 0; i < 7; i++) {
            LocalDate sourceDate = sourceStart.plusDays(i);
            LocalDate targetDate = targetStart.plusDays(i);
            ensureDateInSchedule(schedule, sourceDate);
            ensureDateInSchedule(schedule, targetDate);
            List<MasterScheduleCell> sourceCells = cells.findByRowScheduleIdAndWorkDate(scheduleId, sourceDate);
            for (MasterScheduleCell source : sourceCells) {
                upsertCell(source.getRow(), targetDate, source.getValueRaw());
            }
        }
    }

    private MasterScheduleCellDto updateCell(MasterSchedule schedule, Map<Long, MasterScheduleRow> rowMap, MasterScheduleCellUpdateRequest item) {
        MasterScheduleRow row = rowMap.get(item.rowId());
        if (row == null || !Objects.equals(row.getSchedule().getId(), schedule.getId())) {
            throw new NotFoundException("Row not found in schedule: " + item.rowId());
        }
        ensureDateInSchedule(schedule, item.workDate());
        String raw = item.valueRaw();
        if (raw == null || raw.trim().isEmpty()) {
            cells.findByRowIdAndWorkDate(row.getId(), item.workDate())
                    .ifPresent(cells::delete);
            return null;
        }
        MasterScheduleValueParser.ParsedValue parsed = parser.parse(raw);
        MasterScheduleCell cell = cells.findByRowIdAndWorkDate(row.getId(), item.workDate())
                .orElseGet(() -> MasterScheduleCell.builder()
                        .row(row)
                        .workDate(item.workDate())
                        .build());
        cell.setValueRaw(parsed.raw());
        cell.setValueNum(parsed.valueNum());
        cell.setUnitsCount(parsed.unitsCount());
        cell = cells.save(cell);
        return toCellDto(cell);
    }

    private void upsertCell(MasterScheduleRow row, LocalDate date, String valueRaw) {
        if (valueRaw == null || valueRaw.trim().isEmpty()) {
            cells.findByRowIdAndWorkDate(row.getId(), date).ifPresent(cells::delete);
            return;
        }
        MasterScheduleValueParser.ParsedValue parsed = parser.parse(valueRaw);
        MasterScheduleCell cell = cells.findByRowIdAndWorkDate(row.getId(), date)
                .orElseGet(() -> MasterScheduleCell.builder()
                        .row(row)
                        .workDate(date)
                        .build());
        cell.setValueRaw(parsed.raw());
        cell.setValueNum(parsed.valueNum());
        cell.setUnitsCount(parsed.unitsCount());
        cells.save(cell);
    }

    private MasterSchedule getScheduleOrThrow(Long scheduleId, Long userId) {
        MasterSchedule schedule = schedules.findByIdAndDeletedAtIsNull(scheduleId)
                .orElseThrow(() -> new NotFoundException("Master schedule not found: " + scheduleId));
        security.assertAtLeastManager(userId, schedule.getRestaurant().getId());
        return schedule;
    }

    private void validatePeriod(LocalDate start, LocalDate end) {
        if (start == null || end == null) {
            throw new BadRequestException("Period start and end are required");
        }
        if (end.isBefore(start)) {
            throw new BadRequestException("Period end must be after start");
        }
        long days = ChronoUnit.DAYS.between(start, end) + 1;
        if (days > MAX_PERIOD_DAYS) {
            throw new BadRequestException("Period is too long. Max " + MAX_PERIOD_DAYS + " days");
        }
    }

    private void ensureDateInSchedule(MasterSchedule schedule, LocalDate date) {
        if (date.isBefore(schedule.getPeriodStart()) || date.isAfter(schedule.getPeriodEnd())) {
            throw new ConflictException("Date is outside schedule period");
        }
    }

    private MasterScheduleSummaryDto toSummaryDto(MasterSchedule schedule) {
        return new MasterScheduleSummaryDto(
                schedule.getId(),
                schedule.getRestaurant().getId(),
                schedule.getName(),
                schedule.getPeriodStart(),
                schedule.getPeriodEnd(),
                schedule.getMode(),
                schedule.getPlannedRevenue()
        );
    }

    private MasterScheduleDto toDto(MasterSchedule schedule, List<MasterScheduleRow> scheduleRows, List<MasterScheduleCell> scheduleCells) {
        List<MasterScheduleRowDto> rowDtos = scheduleRows.stream()
                .sorted(rowComparator())
                .map(this::toRowDto)
                .toList();
        List<MasterScheduleCellDto> cellDtos = scheduleCells.stream()
                .map(this::toCellDto)
                .toList();
        return new MasterScheduleDto(
                schedule.getId(),
                schedule.getRestaurant().getId(),
                schedule.getName(),
                schedule.getPeriodStart(),
                schedule.getPeriodEnd(),
                schedule.getMode(),
                schedule.getPlannedRevenue(),
                rowDtos,
                cellDtos
        );
    }

    private MasterScheduleRowDto toRowDto(MasterScheduleRow row) {
        Position position = row.getPosition();
        return new MasterScheduleRowDto(
                row.getId(),
                position.getId(),
                position.getName(),
                row.getRowIndex(),
                row.getSalaryHandling(),
                row.getRateOverride(),
                row.getAmountOverride(),
                position.getPayType(),
                position.getPayRate(),
                position.getNormHours()
        );
    }

    private MasterScheduleCellDto toCellDto(MasterScheduleCell cell) {
        return new MasterScheduleCellDto(
                cell.getId(),
                cell.getRow().getId(),
                cell.getWorkDate(),
                cell.getValueRaw(),
                cell.getValueNum(),
                cell.getUnitsCount()
        );
    }

    private List<MasterScheduleRow> createRowsForPositions(MasterSchedule schedule, List<Position> activePositions) {
        if (activePositions.isEmpty()) {
            return List.of();
        }
        List<MasterScheduleRow> rowsToCreate = activePositions.stream()
                .map(position -> MasterScheduleRow.builder()
                        .schedule(schedule)
                        .position(position)
                        .rowIndex(0)
                        .salaryHandling(SalaryHandling.PRORATE)
                        .build())
                .toList();

        return rows.saveAll(rowsToCreate);
    }

    private Comparator<Position> positionComparator() {
        Collator collator = Collator.getInstance(new Locale("ru", "RU"));
        collator.setStrength(Collator.PRIMARY);
        return Comparator.comparingInt((Position position) -> roleOrder(position.getLevel()))
                .thenComparing(Position::getName, collator)
                .thenComparing(Position::getId);
    }

    private Comparator<MasterScheduleRow> rowComparator() {
        Comparator<Position> positionComparator = positionComparator();
        return Comparator.comparing(MasterScheduleRow::getPosition, positionComparator)
                .thenComparing(MasterScheduleRow::getId, Comparator.nullsLast(Long::compareTo));
    }

    private int roleOrder(RestaurantRole role) {
        if (role == null) {
            return Integer.MAX_VALUE;
        }
        return switch (role) {
            case ADMIN -> 0;
            case MANAGER -> 1;
            case STAFF -> 2;
        };
    }
}