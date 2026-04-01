package ru.staffly.dictionary.model;

import ru.staffly.restaurant.model.RestaurantRole;

import java.util.EnumSet;
import java.util.Set;

public enum PositionSpecialization {
    EXAMINER(EnumSet.of(RestaurantRole.MANAGER));

    private final Set<RestaurantRole> allowedLevels;

    PositionSpecialization(Set<RestaurantRole> allowedLevels) {
        this.allowedLevels = Set.copyOf(allowedLevels);
    }

    public boolean supportsLevel(RestaurantRole level) {
        return level != null && allowedLevels.contains(level);
    }
}