package ru.staffly.dictionary.model;

import java.util.Collection;
import java.util.Comparator;
import java.util.LinkedHashSet;
import java.util.Set;
import java.util.stream.Collectors;

public final class PositionSpecializations {
    private PositionSpecializations() {}

    public static Set<PositionSpecialization> sortedCopy(Collection<PositionSpecialization> specializations) {
        if (specializations == null || specializations.isEmpty()) {
            return Set.of();
        }
        return specializations.stream()
                .filter(java.util.Objects::nonNull)
                .sorted(Comparator.comparing(Enum::name))
                .collect(Collectors.toCollection(LinkedHashSet::new));
    }

    public static boolean hasExaminer(Collection<PositionSpecialization> specializations) {
        return specializations != null && specializations.contains(PositionSpecialization.EXAMINER);
    }
}