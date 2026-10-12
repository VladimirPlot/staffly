package ru.staffly.common_schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common_schedule.repository.CommonScheduleRepository;
import ru.staffly.schedule.model.Schedule;

import java.time.LocalDate;
import java.util.Objects;
import java.util.stream.Collectors;

/** Called while the restaurant lifecycle mutex and source schedule lock are held. */
@Service
@RequiredArgsConstructor
public class CommonScheduleDependencies {
    private final CommonScheduleRepository commonSchedules;

    public void assertCanDelete(Long scheduleId) {
        var dependencies = commonSchedules.findDependingOn(scheduleId);
        if (!dependencies.isEmpty()) {
            throw new ConflictException("График используется в общих графиках: " + dependencies.stream()
                    .map(c -> c.getTitle()).collect(Collectors.joining(", "))
                    + ". Сначала измените их состав или удалите общий график.");
        }
    }

    public void assertCompatiblePeriod(Schedule source, LocalDate start, LocalDate end) {
        if (Objects.equals(source.getStartDate(), start) && Objects.equals(source.getEndDate(), end)) return;
        for (var common : commonSchedules.findDependingOn(source.getId())) {
            var primary = common.primary();
            boolean changesPrimary = Objects.equals(primary.getId(), source.getId());
            var primaryStart = changesPrimary ? start : primary.getStartDate();
            var primaryEnd = changesPrimary ? end : primary.getEndDate();
            for (var included : common.getSources()) {
                boolean changesIncluded = Objects.equals(included.getId(), source.getId());
                var includedStart = changesIncluded ? start : included.getStartDate();
                var includedEnd = changesIncluded ? end : included.getEndDate();
                if (includedStart.isBefore(primaryStart) || includedEnd.isAfter(primaryEnd)) {
                    throw new ConflictException("Новый период несовместим с общим графиком «"
                            + common.getTitle() + "». Сначала измените его состав.");
                }
            }
        }
    }
}
