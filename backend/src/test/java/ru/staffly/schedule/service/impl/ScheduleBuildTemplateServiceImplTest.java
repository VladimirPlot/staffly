package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.Arguments;
import org.junit.jupiter.params.provider.MethodSource;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import jakarta.persistence.EntityManager;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.SaveScheduleBuildCoverageRuleRequest;
import ru.staffly.schedule.dto.SaveScheduleBuildPositionConfigRequest;
import ru.staffly.schedule.dto.SaveScheduleBuildShiftOptionRequest;
import ru.staffly.schedule.dto.SaveScheduleBuildTemplateRequest;
import ru.staffly.schedule.dto.ScheduleBuildTemplateDto;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleBuildTemplateImpactPlanner;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.security.SecurityService;

import java.time.LocalTime;
import java.util.List;
import java.util.stream.Stream;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleBuildTemplateServiceImplTest {

    @Mock private ScheduleBuildTemplateRepository templates;
    @Mock private ScheduleRepository schedules;
    @Mock private RestaurantRepository restaurants;
    @Mock private PositionRepository positions;
    @Mock private RestaurantMemberRepository members;
    @Mock private SecurityService securityService;
    @Mock private ScheduleAccessService scheduleAccessService;
    @Mock private ScheduleBuildTemplateImpactPlanner impactPlanner;
    @Mock private SchedulePreferenceLifecycleService preferenceLifecycle;
    @Mock private EntityManager entityManager;

    private ScheduleBuildTemplateServiceImpl service;

    @BeforeEach
    void setUp() {
        service = new ScheduleBuildTemplateServiceImpl(
                templates, schedules, restaurants, positions, members, securityService, scheduleAccessService,
                impactPlanner, preferenceLifecycle, entityManager
        );
        Restaurant restaurant = Restaurant.builder().id(1L).build();
        Position position = Position.builder().id(2L).restaurant(restaurant).name("Cook").build();
        when(restaurants.findById(1L)).thenReturn(java.util.Optional.of(restaurant));
        when(positions.findAllById(any())).thenReturn(List.of(position));
        lenient().when(templates.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @ParameterizedTest(name = "work period {0}-{1} accepts shift {2}-{3}")
    @MethodSource("validIntervals")
    void acceptsCanonicalShiftPlacements(String workStart, String workEnd, String shiftStart, String shiftEnd) {
        ScheduleBuildTemplateDto result = create(workStart, workEnd, shiftStart, shiftEnd);

        assertEquals(time(workStart), result.positionConfigs().get(0).workPeriodStart());
        assertEquals(time(workEnd), result.positionConfigs().get(0).workPeriodEnd());
        assertEquals(time(shiftStart), result.positionConfigs().get(0).shiftOptions().get(0).startTime());
        assertEquals(time(shiftEnd), result.positionConfigs().get(0).shiftOptions().get(0).endTime());
    }

    @ParameterizedTest(name = "work period {0}-{1} rejects shift {2}-{3}")
    @MethodSource("invalidIntervals")
    void rejectsShiftPlacementsOutsideCanonicalWorkPeriod(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd
    ) {
        assertThrows(BadRequestException.class, () -> create(workStart, workEnd, shiftStart, shiftEnd));
    }

    @Test
    void reportsRawValuesWhenShiftDoesNotFit() {
        BadRequestException error = assertThrows(
                BadRequestException.class,
                () -> create("00:00", "00:00", "18:00", "06:00")
        );

        assertEquals(
                "Вариант смены 18:00–06:00 не помещается в рабочий период 00:00–00:00",
                error.getMessage()
        );
    }

    @ParameterizedTest(name = "work period {0}-{1}, shift {2}-{3} accepts coverage {4}-{5}")
    @MethodSource("validCoverageRules")
    void acceptsCanonicalCoverageRules(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            String coverageStart,
            String coverageEnd
    ) {
        ScheduleBuildTemplateDto result = createWithCoverage(
                workStart, workEnd, shiftStart, shiftEnd, coverageStart, coverageEnd
        );

        assertEquals(time(coverageStart), result.positionConfigs().get(0).coverageRules().get(0).startTime());
        assertEquals(time(coverageEnd), result.positionConfigs().get(0).coverageRules().get(0).endTime());
    }

    @ParameterizedTest(name = "work period {0}-{1}, shift {2}-{3} rejects coverage {4}-{5}")
    @MethodSource("invalidCoverageRules")
    void rejectsInvalidCanonicalCoverageRules(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            String coverageStart,
            String coverageEnd
    ) {
        assertThrows(BadRequestException.class, () -> createWithCoverage(
                workStart, workEnd, shiftStart, shiftEnd, coverageStart, coverageEnd
        ));
    }

    @Test
    void reportsMissingCanonicalCoveringShiftOption() {
        BadRequestException error = assertThrows(
                BadRequestException.class,
                () -> createWithCoverage("10:00", "06:00", "10:00", "18:00", "18:00", "06:00")
        );

        assertEquals(
                "Для правила покрытия 1 18:00–06:00 не найден подходящий вариант смены. "
                        + "Добавьте вариант смены, который покрывает этот интервал.",
                error.getMessage()
        );
    }

    private ScheduleBuildTemplateDto create(String workStart, String workEnd, String shiftStart, String shiftEnd) {
        return create(workStart, workEnd, shiftStart, shiftEnd, List.of());
    }

    private ScheduleBuildTemplateDto createWithCoverage(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            String coverageStart,
            String coverageEnd
    ) {
        SaveScheduleBuildCoverageRuleRequest coverageRule = new SaveScheduleBuildCoverageRuleRequest(
                1, time(coverageStart), time(coverageEnd), 1, null
        );
        return create(workStart, workEnd, shiftStart, shiftEnd, List.of(coverageRule));
    }

    private ScheduleBuildTemplateDto create(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            List<SaveScheduleBuildCoverageRuleRequest> coverageRules
    ) {
        SaveScheduleBuildShiftOptionRequest shift = new SaveScheduleBuildShiftOptionRequest(
                time(shiftStart), time(shiftEnd), null, null
        );
        SaveScheduleBuildPositionConfigRequest config = new SaveScheduleBuildPositionConfigRequest(
                List.of(2L), time(workStart), time(workEnd), null, null, null, null,
                List.of(), List.of(shift), coverageRules, List.of(), null
        );
        return service.create(
                1L,
                3L,
                new SaveScheduleBuildTemplateRequest("Template", null, true, List.of(config))
        );
    }

    private static Stream<Arguments> validIntervals() {
        return Stream.of(
                // A: overnight business day
                arguments("10:00", "06:00", "10:00", "18:00"),
                arguments("10:00", "06:00", "18:00", "06:00"),
                arguments("10:00", "06:00", "21:00", "02:00"),
                arguments("10:00", "06:00", "00:00", "06:00"),
                arguments("10:00", "06:00", "10:00", "06:00"),
                // B: calendar-day business day
                arguments("00:00", "00:00", "00:00", "12:00"),
                arguments("00:00", "00:00", "12:00", "00:00"),
                arguments("00:00", "00:00", "00:00", "06:00"),
                arguments("00:00", "00:00", "18:00", "00:00"),
                // C: 24-hour business day starting at 10:00
                arguments("10:00", "10:00", "10:00", "18:00"),
                arguments("10:00", "10:00", "18:00", "06:00"),
                arguments("10:00", "10:00", "00:00", "06:00"),
                arguments("10:00", "10:00", "06:00", "10:00"),
                // D: same-day business day
                arguments("10:00", "18:00", "10:00", "18:00"),
                arguments("10:00", "18:00", "10:00", "17:00"),
                arguments("10:00", "18:00", "14:00", "18:00")
        );
    }

    private static Stream<Arguments> invalidIntervals() {
        return Stream.of(
                arguments("10:00", "06:00", "08:00", "12:00"),
                arguments("10:00", "06:00", "05:00", "11:00"),
                arguments("10:00", "06:00", "06:00", "10:00"),
                arguments("10:00", "06:00", "10:00", "10:00"),
                arguments("10:00", "06:00", "00:00", "00:00"),
                arguments("00:00", "00:00", "18:00", "06:00"),
                arguments("00:00", "00:00", "21:00", "02:00"),
                arguments("00:00", "00:00", "00:00", "00:00"),
                arguments("10:00", "10:00", "09:00", "11:00"),
                arguments("10:00", "10:00", "10:00", "10:00"),
                arguments("10:00", "18:00", "18:00", "06:00"),
                arguments("10:00", "18:00", "08:00", "12:00"),
                arguments("10:00", "18:00", "17:00", "20:00")
        );
    }

    private static Stream<Arguments> validCoverageRules() {
        return Stream.of(
                arguments("10:00", "06:00", "10:00", "18:00", "10:00", "18:00"),
                arguments("10:00", "06:00", "18:00", "06:00", "18:00", "06:00"),
                arguments("10:00", "06:00", "21:00", "02:00", "21:00", "02:00"),
                arguments("10:00", "06:00", "18:00", "06:00", "00:00", "06:00"),
                arguments("00:00", "00:00", "00:00", "06:00", "00:00", "06:00"),
                arguments("00:00", "00:00", "18:00", "00:00", "18:00", "00:00"),
                arguments("10:00", "10:00", "18:00", "06:00", "18:00", "06:00"),
                arguments("10:00", "10:00", "18:00", "06:00", "00:00", "06:00"),
                arguments("10:00", "10:00", "06:00", "10:00", "06:00", "10:00"),
                arguments("10:00", "06:00", "18:00", "06:00", "21:00", "02:00")
        );
    }

    private static Stream<Arguments> invalidCoverageRules() {
        return Stream.of(
                // Partial overlap is not full coverage.
                arguments("10:00", "06:00", "18:00", "02:00", "00:00", "06:00"),
                // Coverage must first fit inside the work period.
                arguments("10:00", "18:00", "10:00", "18:00", "17:00", "20:00"),
                arguments("00:00", "00:00", "00:00", "06:00", "18:00", "06:00"),
                arguments("00:00", "00:00", "00:00", "06:00", "21:00", "02:00"),
                arguments("10:00", "10:00", "10:00", "18:00", "09:00", "11:00"),
                arguments("10:00", "06:00", "10:00", "18:00", "10:00", "10:00"),
                arguments("00:00", "00:00", "00:00", "06:00", "00:00", "00:00"),
                // No shift option covers this otherwise valid rule.
                arguments("10:00", "06:00", "10:00", "18:00", "18:00", "06:00")
        );
    }

    private static Arguments arguments(String workStart, String workEnd, String shiftStart, String shiftEnd) {
        return Arguments.of(workStart, workEnd, shiftStart, shiftEnd);
    }

    private static Arguments arguments(
            String workStart,
            String workEnd,
            String shiftStart,
            String shiftEnd,
            String coverageStart,
            String coverageEnd
    ) {
        return Arguments.of(workStart, workEnd, shiftStart, shiftEnd, coverageStart, coverageEnd);
    }

    private static LocalTime time(String value) {
        return LocalTime.parse(value);
    }
}
