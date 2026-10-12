package ru.staffly.common_schedule.dto;

import jakarta.validation.constraints.*;
import java.util.List;

/** The first source determines the period; later sources must fit completely inside it. */
public record CommonScheduleRequest(
        @NotBlank @Size(max = 255) String title,
        @NotNull @Size(min = 2, message = "Общий график должен содержать 2 и более графиков")
        List<@NotNull Long> scheduleIds,
        boolean visibleToPositions,
        @PositiveOrZero Long version
) {}
