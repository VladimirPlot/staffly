package ru.staffly.master_schedule.dto;

import java.math.BigDecimal;
import java.time.LocalDate;

public record MasterScheduleCellDto(
        Long id,
        Long rowId,
        LocalDate workDate,
        String valueRaw,
        BigDecimal valueNum,
        Integer unitsCount
) {}