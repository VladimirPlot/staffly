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
import ru.staffly.master_schedule.repository.MasterScheduleWeekTemplateCellRepository;
import ru.staffly.master_schedule.repository.MasterScheduleWeekTemplatePositionRepository;
import ru.staffly.master_schedule.util.MasterScheduleValueParser;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.text.Collator;
import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.temporal.ChronoUnit;
import java.util.Comparator;
import java.util.EnumMap;
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
    private final MasterScheduleWeekTemplateCellRepository weekTemplateCells;
    private final MasterScheduleWeekTemplatePositionRepository weekTemplatePositions;
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
                .plannedRevenue(request.plannedRevenue())
                .build();
        schedule = schedules.save(schedule);
        List<MasterScheduleRow> createdRows = createRowsForPositions(schedule, activePositions);
        ensureTemplatePositions(schedule, activePositions);
        return toDto(schedule, createdRows, List.of());
    }

    @Transactional
    public MasterScheduleDto get(Long scheduleId, Long userId) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        List<MasterScheduleRow> scheduleRows = normalizeRowIndexes(rows.findByScheduleId(scheduleId));
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
        schedule.setPlannedRevenue(request.plannedRevenue());
        schedules.save(schedule);
        List<MasterScheduleRow> scheduleRows = normalizeRowIndexes(rows.findByScheduleId(scheduleId));
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

        int nextIndex = scheduleRows.stream()
                .filter(r -> Objects.equals(r.getPosition().getId(), position.getId()))
                .mapToInt(MasterScheduleRow::getRowIndex)
                .max()
                .orElse(0) + 1;

        boolean isFirstPositionRow = rows.countByScheduleIdAndPositionId(scheduleId, position.getId()) == 0;
        MasterScheduleRow row = MasterScheduleRow.builder()
                .schedule(schedule)
                .position(position)
                .rowIndex(nextIndex)
                .rateOverride(request.rateOverride())
                .amountOverride(request.amountOverride())
                .payTypeOverride(request.payTypeOverride())
                .build();
        row = rows.save(row);
        if (isFirstPositionRow) {
            ensureTemplatePositions(schedule, List.of(position));
        }
        return toRowDto(row);
    }

    @Transactional
    public MasterScheduleRowDto updateRow(Long scheduleId, Long rowId, Long userId, MasterScheduleRowUpdateRequest request) {
        MasterScheduleRow row = rows.findById(rowId)
                .orElseThrow(() -> new NotFoundException("Row not found: " + rowId));
        MasterSchedule schedule = row.getSchedule();
        if (!Objects.equals(schedule.getId(), scheduleId)) {
            throw new NotFoundException("Row not found in schedule: " + rowId);
        }
        security.assertAtLeastManager(userId, schedule.getRestaurant().getId());
        row.setRateOverride(request.rateOverride());
        row.setAmountOverride(request.amountOverride());
        row.setPayTypeOverride(request.payTypeOverride());
        row = rows.save(row);
        return toRowDto(row);
    }

    @Transactional
    public void deleteRow(Long scheduleId, Long rowId, Long userId) {
        MasterScheduleRow row = rows.findById(rowId)
                .orElseThrow(() -> new NotFoundException("Row not found: " + rowId));
        MasterSchedule schedule = row.getSchedule();
        if (!Objects.equals(schedule.getId(), scheduleId)) {
            throw new NotFoundException("Row not found in schedule: " + rowId);
        }
        security.assertAtLeastManager(userId, schedule.getRestaurant().getId());
        Long positionId = row.getPosition().getId();
        rows.delete(row);
        if (rows.countByScheduleIdAndPositionId(schedule.getId(), positionId) == 0) {
            weekTemplateCells.deleteByScheduleIdAndPositionId(schedule.getId(), positionId);
            weekTemplatePositions.deleteByScheduleIdAndPositionId(schedule.getId(), positionId);
        }
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
    public List<MasterScheduleWeekTemplateCellDto> getWeekTemplate(Long scheduleId, Long userId) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        return weekTemplateCells.findByScheduleId(schedule.getId())
                .stream()
                .map(this::toWeekTemplateDto)
                .toList();
    }

    @Transactional
    public List<MasterScheduleWeekTemplateCellDto> batchUpdateWeekTemplateCells(
            Long scheduleId,
            Long userId,
            MasterScheduleWeekTemplateBatchRequest request
    ) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        List<MasterScheduleWeekTemplateCell> existing = weekTemplateCells.findByScheduleId(scheduleId);
        Map<String, MasterScheduleWeekTemplateCell> existingMap = existing.stream()
                .collect(Collectors.toMap(
                        cell -> templateKey(cell.getPosition().getId(), cell.getWeekday()),
                        cell -> cell
                ));

        List<MasterScheduleWeekTemplateCell> toSave = request.items().stream()
                .map(item -> {
                    Position position = positions.findById(item.positionId())
                            .orElseThrow(() -> new NotFoundException("Position not found: " + item.positionId()));
                    if (!Objects.equals(position.getRestaurant().getId(), schedule.getRestaurant().getId())) {
                        throw new NotFoundException("Position not found in this restaurant");
                    }
                    if (weekTemplatePositions.findByScheduleIdAndPositionId(scheduleId, position.getId()).isEmpty()) {
                        ensureTemplatePositions(schedule, List.of(position));
                    }
                    String key = templateKey(position.getId(), item.weekday());
                    MasterScheduleWeekTemplateCell cell = existingMap.getOrDefault(
                            key,
                            MasterScheduleWeekTemplateCell.builder()
                                    .schedule(schedule)
                                    .position(position)
                                    .weekday(item.weekday())
                                    .build()
                    );
                    cell.setStaffCount(item.staffCount());
                    cell.setUnits(item.units());
                    return cell;
                })
                .toList();

        weekTemplateCells.saveAll(toSave);
        return weekTemplateCells.findByScheduleId(scheduleId)
                .stream()
                .map(this::toWeekTemplateDto)
                .toList();
    }

    @Transactional
    public List<MasterScheduleWeekTemplateCellDto> addWeekTemplatePosition(
            Long scheduleId,
            Long userId,
            MasterScheduleWeekTemplatePositionRequest request
    ) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        Position position = positions.findById(request.positionId())
                .orElseThrow(() -> new NotFoundException("Position not found: " + request.positionId()));
        if (!Objects.equals(position.getRestaurant().getId(), schedule.getRestaurant().getId())) {
            throw new NotFoundException("Position not found in this restaurant");
        }

        boolean exists = weekTemplatePositions.findByScheduleIdAndPositionId(scheduleId, position.getId())
                .isPresent();
        if (exists) {
            throw new ConflictException("Week template already contains this position");
        }

        MasterScheduleWeekTemplatePosition templatePosition = MasterScheduleWeekTemplatePosition.builder()
                .schedule(schedule)
                .position(position)
                .build();
        weekTemplatePositions.save(templatePosition);

        List<MasterScheduleWeekTemplateCell> created = List.of(
                DayOfWeek.MONDAY,
                DayOfWeek.TUESDAY,
                DayOfWeek.WEDNESDAY,
                DayOfWeek.THURSDAY,
                DayOfWeek.FRIDAY,
                DayOfWeek.SATURDAY,
                DayOfWeek.SUNDAY
        ).stream()
                .map(day -> MasterScheduleWeekTemplateCell.builder()
                        .schedule(schedule)
                        .position(position)
                        .weekday(day)
                        .build())
                .toList();
        weekTemplateCells.saveAll(created);

        return weekTemplateCells.findByScheduleId(scheduleId)
                .stream()
                .map(this::toWeekTemplateDto)
                .toList();
    }

    @Transactional
    public void deleteWeekTemplatePosition(Long scheduleId, Long userId, Long positionId) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        weekTemplateCells.deleteByScheduleIdAndPositionId(schedule.getId(), positionId);
        weekTemplatePositions.deleteByScheduleIdAndPositionId(schedule.getId(), positionId);
    }

    @Transactional
    public void applyWeekTemplate(Long scheduleId, Long userId, MasterScheduleApplyWeekTemplateRequest request) {
        MasterSchedule schedule = getScheduleOrThrow(scheduleId, userId);
        List<MasterScheduleWeekTemplatePosition> templatePositions = weekTemplatePositions.findByScheduleId(scheduleId);
        if (templatePositions.isEmpty()) {
            return;
        }

        List<MasterScheduleWeekTemplateCell> templateCells = weekTemplateCells.findByScheduleId(scheduleId);
        Map<Long, Map<DayOfWeek, MasterScheduleWeekTemplateCell>> templateByPosition = templateCells.stream()
                .collect(Collectors.groupingBy(
                        cell -> cell.getPosition().getId(),
                        Collectors.toMap(MasterScheduleWeekTemplateCell::getWeekday, cell -> cell, (a, b) -> a, () -> new EnumMap<>(DayOfWeek.class))
                ));

        List<MasterScheduleRow> scheduleRows = rows.findByScheduleId(scheduleId);
        Map<Long, List<MasterScheduleRow>> rowsByPosition = scheduleRows.stream()
                .collect(Collectors.groupingBy(row -> row.getPosition().getId()));

        List<Long> templatePositionIds = templatePositions.stream()
                .map(position -> position.getPosition().getId())
                .toList();
        Map<String, MasterScheduleCell> existingMap = Map.of();
        if (request.overwriteExisting()) {
            List<MasterScheduleCell> existingCells = cells.findByRowScheduleIdAndWorkDateBetween(
                    scheduleId,
                    schedule.getPeriodStart(),
                    schedule.getPeriodEnd()
            );
            Map<Long, List<MasterScheduleCell>> cellsByPosition = existingCells.stream()
                    .collect(Collectors.groupingBy(cell -> cell.getRow().getPosition().getId()));
            for (Long positionId : templatePositionIds) {
                List<MasterScheduleCell> positionCells = cellsByPosition.getOrDefault(positionId, List.of());
                if (!positionCells.isEmpty()) {
                    cells.deleteAll(positionCells);
                }
            }
        } else {
            List<MasterScheduleCell> existingCells = cells.findByRowScheduleIdAndWorkDateBetween(
                    scheduleId,
                    schedule.getPeriodStart(),
                    schedule.getPeriodEnd()
            );
            existingMap = existingCells.stream()
                    .collect(Collectors.toMap(
                            cell -> cellKey(cell.getRow().getId(), cell.getWorkDate()),
                            cell -> cell
                    ));
        }

        java.util.Set<Long> templatePositionSet = java.util.Set.copyOf(templatePositionIds);

        for (Map.Entry<Long, List<MasterScheduleRow>> entry : rowsByPosition.entrySet()) {
            Long positionId = entry.getKey();
            if (!templatePositionSet.contains(positionId)) {
                rows.deleteAll(entry.getValue());
            }
        }

        List<MasterScheduleRow> updatedRows = rows.findByScheduleId(scheduleId);
        Map<Long, List<MasterScheduleRow>> updatedRowsByPosition = updatedRows.stream()
                .collect(Collectors.groupingBy(row -> row.getPosition().getId()));

        for (Long positionId : templatePositionIds) {
            Map<DayOfWeek, MasterScheduleWeekTemplateCell> positionTemplate = templateByPosition.get(positionId);
            if (positionTemplate == null) {
                continue;
            }
            int maxCount = maxTemplateCount(positionTemplate, schedule.getPeriodStart(), schedule.getPeriodEnd());
            List<MasterScheduleRow> positionRows = updatedRowsByPosition.getOrDefault(positionId, List.of())
                    .stream()
                    .sorted(Comparator.comparingInt(MasterScheduleRow::getRowIndex))
                    .toList();

            if (maxCount > positionRows.size()) {
                int nextIndex = positionRows.stream()
                        .mapToInt(MasterScheduleRow::getRowIndex)
                        .max()
                        .orElse(0);
                createMissingRows(schedule, positionId, maxCount - positionRows.size(), nextIndex);
                positionRows = rows.findByScheduleIdAndPositionId(scheduleId, positionId)
                        .stream()
                        .sorted(Comparator.comparingInt(MasterScheduleRow::getRowIndex))
                        .toList();
            } else if (request.overwriteExisting() && maxCount > 0 && positionRows.size() > maxCount) {
                List<MasterScheduleRow> toDelete = positionRows.subList(maxCount, positionRows.size());
                rows.deleteAll(toDelete);
                positionRows = rows.findByScheduleIdAndPositionId(scheduleId, positionId)
                        .stream()
                        .sorted(Comparator.comparingInt(MasterScheduleRow::getRowIndex))
                        .toList();
            }

            if (positionRows.isEmpty()) {
                continue;
            }

            for (LocalDate date = schedule.getPeriodStart();
                 !date.isAfter(schedule.getPeriodEnd());
                 date = date.plusDays(1)) {
                DayOfWeek weekday = date.getDayOfWeek();
                MasterScheduleWeekTemplateCell templateCell = positionTemplate.get(weekday);
                if (templateCell == null || templateCell.getStaffCount() == null || templateCell.getUnits() == null) {
                    continue;
                }
                int count = templateCell.getStaffCount();
                String valueRaw = templateCell.getUnits().stripTrailingZeros().toPlainString();
                for (int i = 0; i < Math.min(count, positionRows.size()); i++) {
                    MasterScheduleRow row = positionRows.get(i);
                    if (!request.overwriteExisting()
                            && existingMap.containsKey(cellKey(row.getId(), date))) {
                        continue;
                    }
                    upsertCell(row, date, valueRaw);
                }
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
                schedule.getPlannedRevenue(),
                rowDtos,
                cellDtos
        );
    }

    private List<MasterScheduleRow> normalizeRowIndexes(List<MasterScheduleRow> scheduleRows) {
        Map<Long, List<MasterScheduleRow>> grouped = scheduleRows.stream()
                .collect(Collectors.groupingBy(row -> row.getPosition().getId()));
        boolean updated = false;
        for (List<MasterScheduleRow> group : grouped.values()) {
            int minIndex = group.stream()
                    .mapToInt(MasterScheduleRow::getRowIndex)
                    .min()
                    .orElse(1);
            if (minIndex == 0) {
                for (MasterScheduleRow row : group) {
                    row.setRowIndex(row.getRowIndex() + 1);
                }
                updated = true;
            }
        }
        if (updated) {
            return rows.saveAll(scheduleRows);
        }
        return scheduleRows;
    }

    private MasterScheduleRowDto toRowDto(MasterScheduleRow row) {
        Position position = row.getPosition();
        PayType effectivePayType = row.getPayTypeOverride() != null ? row.getPayTypeOverride() : position.getPayType();
        return new MasterScheduleRowDto(
                row.getId(),
                position.getId(),
                position.getName(),
                row.getRowIndex(),
                row.getRateOverride(),
                row.getAmountOverride(),
                effectivePayType,
                row.getPayTypeOverride(),
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

    private MasterScheduleWeekTemplateCellDto toWeekTemplateDto(MasterScheduleWeekTemplateCell cell) {
        return new MasterScheduleWeekTemplateCellDto(
                cell.getId(),
                cell.getPosition().getId(),
                cell.getWeekday(),
                cell.getStaffCount(),
                cell.getUnits()
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
                        .rowIndex(1)
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
                .thenComparing(MasterScheduleRow::getRowIndex)
                .thenComparing(MasterScheduleRow::getId, Comparator.nullsLast(Long::compareTo));
    }

    private void ensureTemplatePositions(MasterSchedule schedule, List<Position> positions) {
        for (Position position : positions) {
            boolean exists = weekTemplatePositions.findByScheduleIdAndPositionId(schedule.getId(), position.getId())
                    .isPresent();
            if (exists) {
                continue;
            }
            MasterScheduleWeekTemplatePosition templatePosition = MasterScheduleWeekTemplatePosition.builder()
                    .schedule(schedule)
                    .position(position)
                    .build();
            weekTemplatePositions.save(templatePosition);
            List<MasterScheduleWeekTemplateCell> cellsToCreate = List.of(
                    DayOfWeek.MONDAY,
                    DayOfWeek.TUESDAY,
                    DayOfWeek.WEDNESDAY,
                    DayOfWeek.THURSDAY,
                    DayOfWeek.FRIDAY,
                    DayOfWeek.SATURDAY,
                    DayOfWeek.SUNDAY
            ).stream()
                    .map(day -> MasterScheduleWeekTemplateCell.builder()
                            .schedule(schedule)
                            .position(position)
                            .weekday(day)
                            .build())
                    .toList();
            weekTemplateCells.saveAll(cellsToCreate);
        }
    }

    private List<MasterScheduleRow> createMissingRows(
            MasterSchedule schedule,
            Long positionId,
            int count,
            int startIndex
    ) {
        if (count <= 0) {
            return List.of();
        }
        Position position = positions.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position not found: " + positionId));
        List<MasterScheduleRow> newRows = java.util.stream.IntStream.rangeClosed(1, count)
                .mapToObj(offset -> MasterScheduleRow.builder()
                        .schedule(schedule)
                        .position(position)
                        .rowIndex(startIndex + offset)
                        .build())
                .toList();
        return rows.saveAll(newRows);
    }

    private int maxTemplateCount(
            Map<DayOfWeek, MasterScheduleWeekTemplateCell> template,
            LocalDate start,
            LocalDate end
    ) {
        int max = 0;
        for (LocalDate date = start; !date.isAfter(end); date = date.plusDays(1)) {
            MasterScheduleWeekTemplateCell cell = template.get(date.getDayOfWeek());
            if (cell != null && cell.getStaffCount() != null) {
                max = Math.max(max, cell.getStaffCount());
            }
        }
        return max;
    }

    private String templateKey(Long positionId, DayOfWeek weekday) {
        return positionId + ":" + weekday;
    }

    private String cellKey(Long rowId, LocalDate date) {
        return rowId + ":" + date;
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
