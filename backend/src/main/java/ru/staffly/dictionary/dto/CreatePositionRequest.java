package ru.staffly.dictionary.dto;

import jakarta.validation.constraints.DecimalMin;
import jakarta.validation.constraints.NotBlank;
import jakarta.validation.constraints.NotNull;
import jakarta.validation.constraints.Size;
import ru.staffly.dictionary.model.PositionSpecialization;
import ru.staffly.master_schedule.model.PayType;
import ru.staffly.restaurant.model.RestaurantRole;

import java.math.BigDecimal;
import java.util.Set;

public record CreatePositionRequest(
        @NotNull Long restaurantId,
        @NotBlank @Size(max = 100) String name,
        RestaurantRole level,
        Set<PositionSpecialization> specializations,
        PayType payType,
        @DecimalMin(value = "0.0", inclusive = true) BigDecimal payRate,
        Integer normHours
) {}
