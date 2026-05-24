package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.SaveScheduleRequest;
import ru.staffly.schedule.dto.ScheduleConfigDto;
import ru.staffly.schedule.dto.StartPreferenceCollectionRequest;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.model.ScheduleCell;
import ru.staffly.schedule.model.SchedulePreferenceCell;
import ru.staffly.schedule.model.SchedulePreferenceSubmission;
import ru.staffly.schedule.model.SchedulePreferenceType;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleShiftMode;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.repository.ScheduleShiftRequestRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAuditService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.lenient;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class ScheduleServiceImplTest {

    private static final Long RESTAURANT_ID = 10L;
    private static final Long ACTOR_USER_ID = 20L;
    private static final Long SCHEDULE_ID = 30L;
    private static final Long POSITION_ID = 40L;

    @Mock
    private ScheduleRepository schedules;
    @Mock
    private RestaurantRepository restaurants;
    @Mock
    private PositionRepository positions;
    @Mock
    private ScheduleShiftRequestRepository shiftRequests;
    @Mock
    private SchedulePreferenceSubmissionRepository preferenceSubmissions;
    @Mock
    private RestaurantMemberRepository members;
    @Mock
    private SecurityService securityService;
    @Mock
    private ScheduleAccessService scheduleAccessService;
    @Mock
    private ScheduleAuditService scheduleAuditService;
    @Mock
    private UserRepository users;
    @Mock
    private InboxMessageService inboxMessages;

    @InjectMocks
    private ScheduleServiceImpl service;

    private Restaurant restaurant;

    @BeforeEach
    void setUp() {
        restaurant = Restaurant.builder().id(RESTAURANT_ID).name("Restaurant").code("r").build();
        lenient().when(scheduleAuditService.getRecentHistory(any(Schedule.class), anyInt())).thenReturn(List.of());
        lenient().when(schedules.save(any(Schedule.class))).thenAnswer(invocation -> invocation.getArgument(0));
    }

    @Test
    void createKeepsBackwardCompatiblePublishedStatus() {
        User actor = User.builder().id(ACTOR_USER_ID).firstName("A").lastName("M").fullName("A M").build();
        RestaurantMember owner = RestaurantMember.builder()
                .id(50L)
                .user(actor)
                .restaurant(restaurant)
                .role(RestaurantRole.MANAGER)
                .build();
        Position position = Position.builder().id(POSITION_ID).restaurant(restaurant).name("Cook").build();
        SaveScheduleRequest request = new SaveScheduleRequest(
                "May",
                new ScheduleConfigDto("2026-05-12", "2026-05-13", List.of(POSITION_ID), true, ScheduleShiftMode.FULL),
                List.of(),
                Map.of(),
                null
        );

        when(restaurants.findById(RESTAURANT_ID)).thenReturn(Optional.of(restaurant));
        when(positions.findByRestaurantId(RESTAURANT_ID)).thenReturn(List.of(position));
        when(schedules.findTitlesByRestaurantId(RESTAURANT_ID)).thenReturn(List.of());
        when(members.findByUserIdAndRestaurantId(ACTOR_USER_ID, RESTAURANT_ID)).thenReturn(Optional.of(owner));
        when(users.findById(ACTOR_USER_ID)).thenReturn(Optional.of(actor));

        var result = service.create(RESTAURANT_ID, ACTOR_USER_ID, request);

        assertThat(result.status()).isEqualTo(ScheduleStatus.PUBLISHED);
        verify(scheduleAuditService).record(
                any(Schedule.class),
                eq(ACTOR_USER_ID),
                eq(ScheduleAuditAction.CREATED),
                eq("График создан")
        );
    }

    @Test
    void createDraftCreatesDraftStatusAndCreatedAudit() {
        User actor = User.builder().id(ACTOR_USER_ID).firstName("A").lastName("M").fullName("A M").build();
        RestaurantMember owner = RestaurantMember.builder()
                .id(50L)
                .user(actor)
                .restaurant(restaurant)
                .role(RestaurantRole.MANAGER)
                .build();
        Position position = Position.builder().id(POSITION_ID).restaurant(restaurant).name("Cook").build();
        SaveScheduleRequest request = new SaveScheduleRequest(
                "May draft",
                new ScheduleConfigDto("2026-05-12", "2026-05-13", List.of(POSITION_ID), true, ScheduleShiftMode.FULL),
                List.of(),
                Map.of(),
                null
        );

        when(restaurants.findById(RESTAURANT_ID)).thenReturn(Optional.of(restaurant));
        when(positions.findByRestaurantId(RESTAURANT_ID)).thenReturn(List.of(position));
        when(schedules.findTitlesByRestaurantId(RESTAURANT_ID)).thenReturn(List.of());
        when(members.findByUserIdAndRestaurantId(ACTOR_USER_ID, RESTAURANT_ID)).thenReturn(Optional.of(owner));
        when(users.findById(ACTOR_USER_ID)).thenReturn(Optional.of(actor));

        var result = service.createDraft(RESTAURANT_ID, ACTOR_USER_ID, request);

        assertThat(result.status()).isEqualTo(ScheduleStatus.DRAFT);
        verify(scheduleAuditService).record(
                any(Schedule.class),
                eq(ACTOR_USER_ID),
                eq(ScheduleAuditAction.CREATED),
                eq("Черновик графика создан")
        );
    }

    @Test
    void createDraftUsesCreateValidationPath() {
        SaveScheduleRequest request = new SaveScheduleRequest(
                "Invalid draft",
                new ScheduleConfigDto("2026-05-13", "2026-05-12", List.of(POSITION_ID), true, ScheduleShiftMode.FULL),
                List.of(),
                Map.of(),
                null
        );

        when(restaurants.findById(RESTAURANT_ID)).thenReturn(Optional.of(restaurant));

        assertThatThrownBy(() -> service.createDraft(RESTAURANT_ID, ACTOR_USER_ID, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("endDate must not be before startDate");
    }

    @Test
    void updateRejectsCollectingPreferencesSchedule() {
        Schedule schedule = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));

        assertThatThrownBy(() -> service.update(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("График в текущем статусе нельзя редактировать обычным способом");
    }

    @Test
    void updateRejectsPreferencesClosedSchedule() {
        Schedule schedule = schedule(ScheduleStatus.PREFERENCES_CLOSED);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));

        assertThatThrownBy(() -> service.update(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID, null))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("График в текущем статусе нельзя редактировать обычным способом");
    }

    @Test
    void startPreferenceCollectionWorksOnlyFromDraftWithFutureDeadline() {
        Schedule schedule = schedule(ScheduleStatus.DRAFT);
        Instant deadline = Instant.now().plusSeconds(3600);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));

        var result = service.startPreferenceCollection(
                RESTAURANT_ID,
                SCHEDULE_ID,
                ACTOR_USER_ID,
                new StartPreferenceCollectionRequest(deadline)
        );

        assertThat(result.status()).isEqualTo(ScheduleStatus.COLLECTING_PREFERENCES);
        assertThat(schedule.getPreferenceDeadline()).isEqualTo(deadline);
        assertThat(schedule.getPreferenceCollectionStartedAt()).isNotNull();
        assertThat(schedule.getPreferenceClosedAt()).isNull();
        assertThat(schedule.getPreferenceAppliedAt()).isNull();
        verify(scheduleAuditService).record(
                schedule,
                ACTOR_USER_ID,
                ScheduleAuditAction.PREFERENCE_COLLECTION_STARTED,
                "Начат сбор пожеланий сотрудников"
        );
    }

    @Test
    void startPreferenceCollectionRejectsPublishedScheduleAndPastDeadline() {
        Schedule published = schedule(ScheduleStatus.PUBLISHED);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(published));

        assertThatThrownBy(() -> service.startPreferenceCollection(
                RESTAURANT_ID,
                SCHEDULE_ID,
                ACTOR_USER_ID,
                new StartPreferenceCollectionRequest(Instant.now().plusSeconds(3600))
        )).isInstanceOf(BadRequestException.class);

        Schedule draft = schedule(ScheduleStatus.DRAFT);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(draft));

        assertThatThrownBy(() -> service.startPreferenceCollection(
                RESTAURANT_ID,
                SCHEDULE_ID,
                ACTOR_USER_ID,
                new StartPreferenceCollectionRequest(Instant.EPOCH)
        )).isInstanceOf(BadRequestException.class);
    }

    @Test
    void closePreferenceCollectionWorksOnlyFromCollectingPreferences() {
        Schedule schedule = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));

        var result = service.closePreferenceCollection(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID);

        assertThat(result.status()).isEqualTo(ScheduleStatus.PREFERENCES_CLOSED);
        assertThat(schedule.getPreferenceClosedAt()).isNotNull();
        verify(scheduleAuditService).record(
                schedule,
                ACTOR_USER_ID,
                ScheduleAuditAction.PREFERENCE_COLLECTION_CLOSED,
                "Сбор пожеланий сотрудников закрыт"
        );
    }


    @Test
    void applyPreferencesSimpleTransfersFullDayPreferencesAndWritesAudit() {
        Schedule schedule = schedule(ScheduleStatus.PREFERENCES_CLOSED);
        ScheduleRow row1 = row(501L, 1L);
        ScheduleRow row2 = row(502L, 2L);
        row1.getCells().add(ScheduleCell.builder()
                .id(700L)
                .row(row1)
                .day(LocalDate.of(2026, 5, 12))
                .value("old")
                .build());
        schedule.setRows(List.of(row1, row2));

        RestaurantMember member1 = RestaurantMember.builder().id(501L).restaurant(restaurant).build();
        RestaurantMember missingRowMember = RestaurantMember.builder().id(999L).restaurant(restaurant).build();
        SchedulePreferenceSubmission submission1 = preferenceSubmission(
                member1,
                preferenceCell(10L, LocalDate.of(2026, 5, 12), SchedulePreferenceType.UNAVAILABLE, true, 1),
                preferenceCell(11L, LocalDate.of(2026, 5, 12), SchedulePreferenceType.AVAILABLE, true, 2),
                preferenceCell(12L, LocalDate.of(2026, 5, 13), SchedulePreferenceType.PREFER_DAY_OFF, true, 1),
                preferenceCell(13L, LocalDate.of(2026, 5, 13), SchedulePreferenceType.PREFER_WORK, false, 2),
                preferenceCell(14L, LocalDate.of(2026, 5, 20), SchedulePreferenceType.PREFER_WORK, true, 1)
        );
        SchedulePreferenceSubmission skippedSubmission = preferenceSubmission(
                missingRowMember,
                preferenceCell(20L, LocalDate.of(2026, 5, 12), SchedulePreferenceType.UNAVAILABLE, true, 1)
        );
        SchedulePreferenceSubmission emptySubmission = preferenceSubmission(
                RestaurantMember.builder().id(502L).restaurant(restaurant).build()
        );

        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));
        when(preferenceSubmissions.findWithCellsByScheduleId(SCHEDULE_ID))
                .thenReturn(List.of(submission1, skippedSubmission, emptySubmission));

        var result = service.applyPreferencesSimple(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID);

        assertThat(result.status()).isEqualTo(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        assertThat(result.preferenceAppliedAt()).isNotNull();
        assertThat(schedule.getStatus()).isEqualTo(ScheduleStatus.DRAFT_FROM_PREFERENCES);
        assertThat(schedule.getPreferenceAppliedAt()).isNotNull();
        assertThat(result.cellValues())
                .containsEntry("501:2026-05-12", "+")
                .containsEntry("501:2026-05-13", "-")
                .doesNotContainKey("502:2026-05-12")
                .doesNotContainKey("999:2026-05-12")
                .doesNotContainKey("501:2026-05-20");
        assertThat(row1.getCells()).hasSize(2);
        assertThat(row1.getCells())
                .filteredOn(cell -> cell.getDay().equals(LocalDate.of(2026, 5, 12)))
                .singleElement()
                .extracting(ScheduleCell::getValue)
                .isEqualTo("+");
        assertThat(row1.getCells())
                .filteredOn(cell -> cell.getDay().equals(LocalDate.of(2026, 5, 13)))
                .singleElement()
                .satisfies(cell -> {
                    assertThat(cell.getValue()).isEqualTo("-");
                    assertThat(cell.getRow()).isSameAs(row1);
                });
        verify(scheduleAuditService).record(
                schedule,
                ACTOR_USER_ID,
                ScheduleAuditAction.PREFERENCES_APPLIED,
                "Пожелания сотрудников внесены в черновик графика"
        );
    }

    @Test
    void applyPreferencesSimpleMapsPreferWorkAndUnavailable() {
        Schedule schedule = schedule(ScheduleStatus.PREFERENCES_CLOSED);
        ScheduleRow row = row(501L, 1L);
        schedule.setRows(List.of(row));
        SchedulePreferenceSubmission submission = preferenceSubmission(
                RestaurantMember.builder().id(501L).restaurant(restaurant).build(),
                preferenceCell(1L, LocalDate.of(2026, 5, 12), SchedulePreferenceType.PREFER_WORK, true, 1),
                preferenceCell(2L, LocalDate.of(2026, 5, 13), SchedulePreferenceType.UNAVAILABLE, true, 1)
        );

        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));
        when(preferenceSubmissions.findWithCellsByScheduleId(SCHEDULE_ID)).thenReturn(List.of(submission));

        var result = service.applyPreferencesSimple(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID);

        assertThat(result.cellValues())
                .containsEntry("501:2026-05-12", "+")
                .containsEntry("501:2026-05-13", "-");
    }

    @Test
    void applyPreferencesSimpleRejectsStatusesOtherThanPreferencesClosed() {
        for (ScheduleStatus status : List.of(
                ScheduleStatus.COLLECTING_PREFERENCES,
                ScheduleStatus.DRAFT,
                ScheduleStatus.PUBLISHED
        )) {
            Schedule schedule = schedule(status);
            when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));

            assertThatThrownBy(() -> service.applyPreferencesSimple(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID))
                    .isInstanceOf(BadRequestException.class)
                    .hasMessage("Внести пожелания можно только после закрытия сбора пожеланий");
        }
    }

    @Test
    void applyPreferencesSimpleRejectsNullPreferenceType() {
        Schedule schedule = schedule(ScheduleStatus.PREFERENCES_CLOSED);
        ScheduleRow row = row(501L, 1L);
        schedule.setRows(List.of(row));
        SchedulePreferenceSubmission submission = preferenceSubmission(
                RestaurantMember.builder().id(501L).restaurant(restaurant).build(),
                preferenceCell(1L, LocalDate.of(2026, 5, 12), null, true, 1)
        );

        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(schedule));
        when(preferenceSubmissions.findWithCellsByScheduleId(SCHEDULE_ID)).thenReturn(List.of(submission));

        assertThatThrownBy(() -> service.applyPreferencesSimple(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Preference cell type is required");
    }

    @Test
    void publishWorksOnlyFromDraftStatuses() {
        Schedule draft = schedule(ScheduleStatus.DRAFT);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(draft));

        assertThat(service.publish(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID).status()).isEqualTo(ScheduleStatus.PUBLISHED);
        verify(scheduleAuditService).record(draft, ACTOR_USER_ID, ScheduleAuditAction.PUBLISHED, "График опубликован");

        Schedule collecting = schedule(ScheduleStatus.COLLECTING_PREFERENCES);
        when(schedules.findByIdAndRestaurantId(SCHEDULE_ID, RESTAURANT_ID)).thenReturn(Optional.of(collecting));

        assertThatThrownBy(() -> service.publish(RESTAURANT_ID, SCHEDULE_ID, ACTOR_USER_ID))
                .isInstanceOf(BadRequestException.class);
    }


    private ScheduleRow row(Long memberId, Long id) {
        return ScheduleRow.builder()
                .id(id)
                .memberId(memberId)
                .displayName("Member " + memberId)
                .positionId(POSITION_ID)
                .positionName("Cook")
                .sortOrder(id.intValue())
                .build();
    }

    private SchedulePreferenceSubmission preferenceSubmission(RestaurantMember member, SchedulePreferenceCell... cells) {
        SchedulePreferenceSubmission submission = SchedulePreferenceSubmission.builder()
                .schedule(schedule(ScheduleStatus.PREFERENCES_CLOSED))
                .member(member)
                .cells(List.of(cells))
                .build();
        for (SchedulePreferenceCell cell : cells) {
            cell.setSubmission(submission);
        }
        return submission;
    }

    private SchedulePreferenceCell preferenceCell(Long id,
                                                  LocalDate day,
                                                  SchedulePreferenceType type,
                                                  boolean fullDay,
                                                  int sortOrder) {
        return SchedulePreferenceCell.builder()
                .id(id)
                .day(day)
                .type(type)
                .fullDay(fullDay)
                .sortOrder(sortOrder)
                .build();
    }

    private Schedule schedule(ScheduleStatus status) {
        return Schedule.builder()
                .id(SCHEDULE_ID)
                .restaurant(restaurant)
                .title("Schedule")
                .startDate(LocalDate.of(2026, 5, 12))
                .endDate(LocalDate.of(2026, 5, 13))
                .shiftMode(ScheduleShiftMode.FULL)
                .status(status)
                .positionIds(List.of(POSITION_ID))
                .build();
    }
}
