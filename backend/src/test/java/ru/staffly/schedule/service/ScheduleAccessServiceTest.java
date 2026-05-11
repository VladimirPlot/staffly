package ru.staffly.schedule.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleShiftMode;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleAccessServiceTest {

    private static final Long USER_ID = 1L;
    private static final Long RESTAURANT_ID = 2L;
    private static final Long POSITION_ID = 3L;

    @Mock
    private RestaurantMemberRepository members;
    @Mock
    private SecurityService securityService;

    @InjectMocks
    private ScheduleAccessService service;

    @Test
    void managerCanViewSummaryAndFullScheduleForAllStatuses() {
        when(securityService.hasAtLeastManager(USER_ID, RESTAURANT_ID)).thenReturn(true);

        for (ScheduleStatus status : ScheduleStatus.values()) {
            Schedule schedule = schedule(status);
            assertThat(service.canViewScheduleSummary(USER_ID, schedule)).isTrue();
            assertThat(service.canViewSchedule(USER_ID, schedule)).isTrue();
        }
    }

    @Test
    void staffWithMatchingPositionCanViewSummaryForPublishedAndCollectingPreferences() {
        mockMatchingStaff();

        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.PUBLISHED))).isTrue();
        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.COLLECTING_PREFERENCES))).isTrue();
    }

    @Test
    void staffWithMatchingPositionCannotViewSummaryForNonVisibleStatuses() {
        mockMatchingStaff();

        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.DRAFT))).isFalse();
        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.PREFERENCES_CLOSED))).isFalse();
        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.DRAFT_FROM_PREFERENCES))).isFalse();
    }

    @Test
    void staffWithMatchingPositionCanViewFullOnlyForPublished() {
        mockMatchingStaff();

        assertThat(service.canViewSchedule(USER_ID, schedule(ScheduleStatus.PUBLISHED))).isTrue();
        assertThat(service.canViewSchedule(USER_ID, schedule(ScheduleStatus.DRAFT))).isFalse();
        assertThat(service.canViewSchedule(USER_ID, schedule(ScheduleStatus.PREFERENCES_CLOSED))).isFalse();
        assertThat(service.canViewSchedule(USER_ID, schedule(ScheduleStatus.DRAFT_FROM_PREFERENCES))).isFalse();
    }

    @Test
    void staffCannotViewFullCollectingPreferences() {
        mockMatchingStaff();

        assertThat(service.canViewSchedule(USER_ID, schedule(ScheduleStatus.COLLECTING_PREFERENCES))).isFalse();
    }

    @Test
    void staffWithoutPositionCannotViewSummaryOrFullSchedule() {
        Restaurant restaurant = Restaurant.builder().id(RESTAURANT_ID).build();
        RestaurantMember staff = RestaurantMember.builder()
                .id(4L)
                .restaurant(restaurant)
                .user(User.builder().id(USER_ID).build())
                .role(RestaurantRole.STAFF)
                .position(null)
                .build();
        when(securityService.hasAtLeastManager(USER_ID, RESTAURANT_ID)).thenReturn(false);
        when(members.findByUserIdAndRestaurantId(USER_ID, RESTAURANT_ID)).thenReturn(Optional.of(staff));

        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.PUBLISHED))).isFalse();
        assertThat(service.canViewScheduleSummary(USER_ID, schedule(ScheduleStatus.COLLECTING_PREFERENCES))).isFalse();
        assertThat(service.canViewSchedule(USER_ID, schedule(ScheduleStatus.PUBLISHED))).isFalse();
    }

    private void mockMatchingStaff() {
        when(securityService.hasAtLeastManager(USER_ID, RESTAURANT_ID)).thenReturn(false);
        when(members.findByUserIdAndRestaurantId(USER_ID, RESTAURANT_ID)).thenReturn(Optional.of(matchingStaff()));
    }

    private RestaurantMember matchingStaff() {
        Restaurant restaurant = Restaurant.builder().id(RESTAURANT_ID).build();
        Position position = Position.builder().id(POSITION_ID).restaurant(restaurant).name("Cook").build();
        return RestaurantMember.builder()
                .id(4L)
                .restaurant(restaurant)
                .user(User.builder().id(USER_ID).build())
                .role(RestaurantRole.STAFF)
                .position(position)
                .build();
    }

    private Schedule schedule(ScheduleStatus status) {
        return Schedule.builder()
                .id(10L)
                .restaurant(Restaurant.builder().id(RESTAURANT_ID).build())
                .title("Schedule")
                .startDate(LocalDate.of(2026, 5, 12))
                .endDate(LocalDate.of(2026, 5, 13))
                .shiftMode(ScheduleShiftMode.FULL)
                .status(status)
                .positionIds(List.of(POSITION_ID))
                .build();
    }
}
