package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import java.time.LocalDate;
import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ScheduleContentMapper {
    private static final String[] WEEKDAY_LABELS = {"", "пн", "вт", "ср", "чт", "пт", "сб", "вс"};
    private final ScheduleParticipationRepository participations;

    public ScheduleContentDto toContent(Schedule schedule, List<LocalDate> days) {
        Set<Long> activeScheduleMemberIds = participations.findByScheduleIdOrderById(schedule.getId()).stream()
                .map(p -> p.getMember().getId()).collect(Collectors.toSet());
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
            String key = (row.isHistorical() ? -row.getId() : row.getMemberId()) + ":" + cell.getDay();
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

        return new ScheduleContentDto(config, dayDtos, rowDtos, cellValues, cellSources, cellShifts);
    }

    private ScheduleDayDto toDayDto(LocalDate day) {
        return new ScheduleDayDto(day.toString(), WEEKDAY_LABELS[day.getDayOfWeek().getValue()],
                Integer.toString(day.getDayOfMonth()));
    }
}
