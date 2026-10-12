package ru.staffly.common_schedule.dto;

import java.time.LocalDate;
import java.util.List;

public record CommonScheduleSummaryDto(Long id, Long version, String title,
        LocalDate startDate, LocalDate endDate, boolean visibleToPositions, List<Long> scheduleIds) {}
