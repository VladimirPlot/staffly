package ru.staffly.reminder.service;

import org.junit.jupiter.api.Test;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.reminder.model.*;
import ru.staffly.reminder.repository.ReminderRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;
import java.time.Instant;
import java.util.*;
import static org.mockito.Mockito.*;
import static org.junit.jupiter.api.Assertions.*;

class ReminderDispatchLifecycleTest {
    @Test void multiplePositionTargetsResolveCurrentMembersAndPersonalTargetsFollowPositionChange() {
        var mutex = mock(RestaurantLifecycleMutex.class);
        var reminders = mock(ReminderRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        var inbox = mock(InboxMessageService.class);
        var messages = mock(InboxMessageRepository.class);
        var time = mock(RestaurantTimeService.class);
        var now = Instant.parse("2026-10-10T12:00:00Z");
        when(time.nowInstant()).thenReturn(now);
        var restaurant = Restaurant.builder().id(1L).build();
        var firstPosition = ru.staffly.dictionary.model.Position.builder().id(11L).build();
        var secondPosition = ru.staffly.dictionary.model.Position.builder().id(12L).build();
        var thirdPosition = ru.staffly.dictionary.model.Position.builder().id(13L).build();
        var first = RestaurantMember.builder().id(20L).position(firstPosition).user(User.builder().id(20L).build()).build();
        var second = RestaurantMember.builder().id(30L).position(secondPosition).user(User.builder().id(30L).build()).build();
        var moved = RestaurantMember.builder().id(40L).position(thirdPosition).user(User.builder().id(40L).build()).build();
        var positionReminder = Reminder.builder().id(1L).targetType(ReminderTargetType.POSITION)
                .targetPositions(new LinkedHashSet<>(List.of(firstPosition, secondPosition)))
                .periodicity(ReminderPeriodicity.ONCE).active(true).nextFireAt(now).build();
        var personalReminder = Reminder.builder().id(2L).targetType(ReminderTargetType.MEMBER)
                .targetMembers(new LinkedHashSet<>(List.of(second, moved)))
                .periodicity(ReminderPeriodicity.ONCE).active(true).nextFireAt(now).build();
        when(reminders.findDueReminders(1L, now)).thenReturn(List.of(positionReminder, personalReminder));
        when(members.findActiveWithUserByRestaurantId(1L)).thenReturn(List.of(first, second, moved));
        when(time.today(restaurant)).thenReturn(java.time.LocalDate.of(2026, 10, 10));
        new ReminderDispatchService(mutex, reminders, members, inbox, messages, time).dispatchForRestaurant(restaurant);
        verify(inbox).createEvent(eq(restaurant), isNull(), anyString(), any(), eq("reminder:1:" + now.toEpochMilli()),
                eq(List.of(first, second)), any());
        verify(inbox).createEvent(eq(restaurant), isNull(), anyString(), any(), eq("reminder:2:" + now.toEpochMilli()),
                eq(List.of(second, moved)), any());
    }

    @Test void terminationWinningMutexPreventsLoadingAndSavingOldPersonalReminder() {
        var mutex = mock(RestaurantLifecycleMutex.class);
        var reminders = mock(ReminderRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        var inbox = mock(InboxMessageService.class);
        var messages = mock(InboxMessageRepository.class);
        var time = mock(RestaurantTimeService.class);
        var now = Instant.parse("2026-10-06T12:00:00Z");
        when(time.nowInstant()).thenReturn(now);
        var member = RestaurantMember.builder().id(17L).build();
        var stale = Reminder.builder().id(1L).targetType(ReminderTargetType.MEMBER)
                .targetMember(member).active(true).nextFireAt(now).build();
        // Model termination completing while dispatch waits for its mutex.
        doAnswer(invocation -> {
            stale.setTargetMember(null); stale.setActive(false); stale.setNextFireAt(null);
            return null;
        }).when(mutex).lock(1L);
        when(reminders.findDueReminders(1L, now)).thenAnswer(invocation ->
                stale.isActive() ? List.of(stale) : List.of());
        new ReminderDispatchService(mutex, reminders, members, inbox, messages, time)
                .dispatchForRestaurant(Restaurant.builder().id(1L).build());
        assertNull(stale.getTargetMember());
        assertFalse(stale.isActive());
        verify(reminders, never()).save(any());
        verifyNoInteractions(members, inbox, messages);
        var order = inOrder(mutex, reminders);
        order.verify(mutex).lock(1L);
        order.verify(reminders).findDueReminders(1L, now);
    }

    @Test void personalTargetDoesNotResolveToRehiredMembershipOfSameUser() {
        var mutex = mock(RestaurantLifecycleMutex.class);
        var reminders = mock(ReminderRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        var inbox = mock(InboxMessageService.class);
        var messages = mock(InboxMessageRepository.class);
        var time = mock(RestaurantTimeService.class);
        var now = Instant.parse("2026-10-06T12:00:00Z");
        when(time.nowInstant()).thenReturn(now);
        var user = User.builder().id(100L).build();
        var old = RestaurantMember.builder().id(17L).user(user).endedAt(now).build();
        var rehire = RestaurantMember.builder().id(42L).user(user).build();
        var reminder = Reminder.builder().id(1L).targetType(ReminderTargetType.MEMBER).targetMember(old)
                .periodicity(ReminderPeriodicity.ONCE).active(true).nextFireAt(now).build();
        when(reminders.findDueReminders(1L, now)).thenReturn(List.of(reminder));
        when(members.findActiveWithUserByRestaurantId(1L)).thenReturn(List.of(rehire));
        new ReminderDispatchService(mutex, reminders, members, inbox, messages, time)
                .dispatchForRestaurant(Restaurant.builder().id(1L).build());
        verifyNoInteractions(inbox);
        verify(reminders).save(reminder);
        assertSame(old, reminder.getTargetMember());
        assertFalse(reminder.isActive());
    }
}
