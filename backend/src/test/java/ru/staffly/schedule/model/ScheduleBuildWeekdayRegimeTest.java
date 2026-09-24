package ru.staffly.schedule.model;

import org.junit.jupiter.api.Test;

import java.time.DayOfWeek;
import java.util.ArrayList;
import java.util.EnumSet;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleBuildWeekdayRegimeTest {
    @Test
    void resolvesArbitraryNonContiguousWeekdaySet() {
        ScheduleBuildWeekdayRegime odd = ScheduleBuildWeekdayRegime.builder()
                .daysOfWeek(EnumSet.of(DayOfWeek.MONDAY, DayOfWeek.WEDNESDAY, DayOfWeek.FRIDAY))
                .build();
        ScheduleBuildWeekdayRegime remainder = ScheduleBuildWeekdayRegime.builder()
                .daysOfWeek(EnumSet.of(DayOfWeek.TUESDAY, DayOfWeek.THURSDAY,
                        DayOfWeek.SATURDAY, DayOfWeek.SUNDAY))
                .build();
        ScheduleBuildPositionConfig block = ScheduleBuildPositionConfig.builder()
                .weekdayRegimes(new ArrayList<>(java.util.List.of(odd, remainder)))
                .build();

        assertThat(block.regimeFor(DayOfWeek.FRIDAY)).isSameAs(odd);
        assertThat(block.regimeFor(DayOfWeek.SUNDAY)).isSameAs(remainder);
    }
}
