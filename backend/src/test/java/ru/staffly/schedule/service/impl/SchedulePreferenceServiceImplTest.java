package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.dto.SchedulePreferenceCellRequest;
import ru.staffly.schedule.dto.UpsertMySchedulePreferenceRequest;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class SchedulePreferenceServiceImplTest {
    @Mock private ScheduleRepository schedules;
    @Mock private SchedulePreferenceSubmissionRepository submissions;
    @Mock private RestaurantMemberRepository members;
    @Mock private SecurityService securityService;
    @Mock private ScheduleAccessService scheduleAccessService;
    @Mock private InboxMessageService inboxMessages;
    @Mock private UserRepository users;

    @InjectMocks private SchedulePreferenceServiceImpl service;

    private Schedule schedule;
    private RestaurantMember participant;

    @BeforeEach
    void setUp() {
        Restaurant restaurant = Restaurant.builder().id(10L).name("R").build();
        User owner = User.builder().id(100L).build();
        User creator = User.builder().id(101L).build();
        schedule = Schedule.builder().id(1L).restaurant(restaurant).title("Week")
                .startDate(LocalDate.of(2026,5,1)).endDate(LocalDate.of(2026,5,7))
                .status(ScheduleStatus.COLLECTING_PREFERENCES).positionIds(List.of(5L))
                .preferenceDeadline(Instant.now().plusSeconds(3600)).ownerUser(owner).createdByUser(creator).build();
        participant = RestaurantMember.builder().id(201L).restaurant(restaurant)
                .user(User.builder().id(301L).build())
                .position(ru.staffly.dictionary.model.Position.builder().id(5L).name("Cook").build()).build();

        when(schedules.findByIdAndRestaurantId(1L, 10L)).thenReturn(Optional.of(schedule));
        when(members.findByUserIdAndRestaurantIdWithPosition(301L, 10L)).thenReturn(Optional.of(participant));
        when(members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(10L, List.of(5L))).thenReturn(List.of(participant));
        when(submissions.findForUpdateByScheduleIdAndMemberId(1L, 201L)).thenReturn(Optional.empty());
        when(submissions.save(any())).thenAnswer(i -> i.getArgument(0));
    }

    @Test
    void upsertMyPreferenceSendsAllSubmittedNotificationOnlyOnce() {
        var submission = SchedulePreferenceSubmission.builder().member(participant).build();
        when(submissions.findByScheduleIdWithMember(1L)).thenReturn(List.of(submission));

        RestaurantMember ownerMember = RestaurantMember.builder().id(401L).user(User.builder().id(100L).build()).build();
        RestaurantMember creatorMember = RestaurantMember.builder().id(402L).user(User.builder().id(101L).build()).build();
        when(members.findByRestaurantIdAndUserIdIn(eq(10L), anySet())).thenReturn(List.of(ownerMember, creatorMember));
        when(users.findById(anyLong())).thenReturn(Optional.of(User.builder().id(100L).build()));

        service.upsertMyPreference(10L, 1L, 301L, new UpsertMySchedulePreferenceRequest(List.of(
                new SchedulePreferenceCellRequest("2026-05-02", SchedulePreferenceType.WANT_SHIFT, true, null, null, null)
        ), null));

        verify(inboxMessages, times(1)).createEvent(
                eq(schedule.getRestaurant()), any(), contains("Все сотрудники отправили пожелания"),
                eq(InboxEventSubtype.SCHEDULE_PREFERENCES), contains("schedulePreferences:allSubmitted"), anyList(), eq(LocalDate.of(2026,5,7))
        );

        service.upsertMyPreference(10L, 1L, 301L, new UpsertMySchedulePreferenceRequest(List.of(), null));
        verify(inboxMessages, times(1)).createEvent(any(), any(), contains("Все сотрудники отправили пожелания"), any(), anyString(), anyList(), any());
    }
}
