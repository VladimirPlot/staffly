package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.schedule.model.PreferenceCollectionMode;

import static org.assertj.core.api.Assertions.assertThatCode;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SchedulePreferenceModeValidationTest {

    @Test
    void acceptsDayLevelWithoutTemplate() {
        assertThatCode(() -> ScheduleServiceImpl.validatePreferenceCollectionModeSelection(
                PreferenceCollectionMode.DAY_LEVEL, null)).doesNotThrowAnyException();
    }

    @Test
    void rejectsDayLevelWithTemplate() {
        assertThatThrownBy(() -> ScheduleServiceImpl.validatePreferenceCollectionModeSelection(
                PreferenceCollectionMode.DAY_LEVEL, 10L)).isInstanceOf(BadRequestException.class);
    }

    @Test
    void rejectsShiftOptionsWithoutTemplate() {
        assertThatThrownBy(() -> ScheduleServiceImpl.validatePreferenceCollectionModeSelection(
                PreferenceCollectionMode.SHIFT_OPTIONS, null)).isInstanceOf(BadRequestException.class);
    }
}
