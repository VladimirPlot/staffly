package ru.staffly.schedule.dto;

import ru.staffly.schedule.model.ScheduleCellSource;

import java.time.LocalDate;

public record ScheduleChangeItemDto(Long memberId, Long rowId, String memberName, LocalDate day,
                                    String oldValue, String newValue, ScheduleCellSource oldSource,
                                    ScheduleCellSource newSource, boolean isPastDate) {}
