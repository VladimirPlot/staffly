package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.dto.SchedulePreferenceCellRequest;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceShiftOptionSnapshot;
import ru.staffly.schedule.model.SchedulePreferenceType;

import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

class SchedulePreferenceSubmissionValidationTest {

    private static final LocalDate DAY = LocalDate.of(2026, 9, 18);
    private static final Position EMPLOYEE_POSITION = Position.builder().id(1L).name("Официант").build();
    private static final RestaurantMember MEMBER = RestaurantMember.builder().position(EMPLOYEE_POSITION).build();

    private final SchedulePreferenceServiceImpl service = new SchedulePreferenceServiceImpl(
            null, null, null, null, null, null, null, null);

    @Test
    void acceptsDayLevelFullDayAvailable() {
        assertAccepted(schedule(PreferenceCollectionMode.DAY_LEVEL), request(SchedulePreferenceType.AVAILABLE, true, null, null));
    }

    @Test
    void rejectsDayLevelTimedAvailable() {
        assertRejected(schedule(PreferenceCollectionMode.DAY_LEVEL), request(SchedulePreferenceType.AVAILABLE, false, "10:00", "17:00"));
    }

    @Test
    void acceptsShiftOptionsExactApplicableSnapshot() {
        assertAccepted(shiftOptionsSchedule(1L), request(SchedulePreferenceType.AVAILABLE, false, "10:00", "17:00"));
    }

    @Test
    void rejectsShiftOptionsArbitraryInterval() {
        assertRejected(shiftOptionsSchedule(1L), request(SchedulePreferenceType.AVAILABLE, false, "11:00", "13:00"));
    }

    @Test
    void rejectsShiftOptionsSnapshotForAnotherPosition() {
        assertRejected(shiftOptionsSchedule(2L), request(SchedulePreferenceType.AVAILABLE, false, "10:00", "17:00"));
    }

    @Test
    void acceptsShiftOptionsFullDayUnavailable() {
        assertAccepted(shiftOptionsSchedule(1L), request(SchedulePreferenceType.UNAVAILABLE, true, null, null));
    }

    @Test
    void rejectsShiftOptionsTimedUnavailable() {
        assertRejected(shiftOptionsSchedule(1L), request(SchedulePreferenceType.UNAVAILABLE, false, "10:00", "17:00"));
    }

    @Test
    void acceptsShiftOptionsFullDayPreferDayOff() {
        assertAccepted(shiftOptionsSchedule(1L), request(SchedulePreferenceType.PREFER_DAY_OFF, true, null, null));
    }

    @Test
    void rejectsShiftOptionsTimedPreferDayOff() {
        assertRejected(shiftOptionsSchedule(1L), request(SchedulePreferenceType.PREFER_DAY_OFF, false, "10:00", "17:00"));
    }

    private void assertAccepted(Schedule schedule, SchedulePreferenceCellRequest request) {
        List<SchedulePreferenceCell> cells = service.buildCells(schedule, MEMBER.getPosition().getId(), List.of(request));
        assertThat(cells).singleElement().satisfies(cell -> {
            assertThat(cell.getType()).isEqualTo(request.type());
            assertThat(cell.isFullDay()).isEqualTo(request.fullDay());
        });
    }

    private void assertRejected(Schedule schedule, SchedulePreferenceCellRequest request) {
        assertThatThrownBy(() -> service.buildCells(schedule, MEMBER.getPosition().getId(), List.of(request)))
                .isInstanceOf(BadRequestException.class);
    }

    private static Schedule shiftOptionsSchedule(Long snapshotPositionId) {
        Schedule schedule = schedule(PreferenceCollectionMode.SHIFT_OPTIONS);
        schedule.getPreferenceShiftOptionSnapshots().add(SchedulePreferenceShiftOptionSnapshot.builder()
                .startTime(LocalTime.of(10, 0))
                .endTime(LocalTime.of(17, 0))
                .positionIds(new LinkedHashSet<>(List.of(snapshotPositionId)))
                .sortOrder(0)
                .build());
        return schedule;
    }

    private static Schedule schedule(PreferenceCollectionMode mode) {
        return Schedule.builder()
                .startDate(DAY)
                .endDate(DAY)
                .preferenceCollectionMode(mode)
                .preferenceShiftOptionSnapshots(new ArrayList<>())
                .build();
    }

    private static SchedulePreferenceCellRequest request(SchedulePreferenceType type, boolean fullDay,
                                                          String startTime, String endTime) {
        return new SchedulePreferenceCellRequest(DAY.toString(), type, fullDay, startTime, endTime, null);
    }
}
