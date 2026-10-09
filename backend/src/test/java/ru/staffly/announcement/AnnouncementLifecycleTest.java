package ru.staffly.announcement;

import org.junit.jupiter.api.Test;
import org.springframework.test.web.servlet.setup.MockMvcBuilders;
import ru.staffly.announcement.controller.AnnouncementController;
import ru.staffly.announcement.dto.AnnouncementRequest;
import ru.staffly.announcement.dto.AnnouncementAudience;
import com.fasterxml.jackson.databind.ObjectMapper;
import ru.staffly.announcement.service.AnnouncementService;
import ru.staffly.announcement.repository.AnnouncementOperationRepository;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.exception.GlobalExceptionHandler;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.job.InboxRetentionJob;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.time.ZoneId;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.*;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

class AnnouncementLifecycleTest {
    final InboxMessageRepository messages = mock(InboxMessageRepository.class);
    final InboxMessageService inbox = mock(InboxMessageService.class);
    final RestaurantRepository restaurants = mock(RestaurantRepository.class);
    final PositionRepository positions = mock(PositionRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final SecurityService security = mock(SecurityService.class);
    final PushEnqueueService push = mock(PushEnqueueService.class);
    final AnnouncementService service = new AnnouncementService(
            messages, inbox, restaurants, positions, members, users, security, push, new ObjectMapper(),
            mock(AnnouncementOperationRepository.class));

    @Test void sentAnnouncementCannotBeEditedThroughTheOldEndpoint() throws Exception {
        var mvc = MockMvcBuilders.standaloneSetup(new AnnouncementController(service))
                .setControllerAdvice(new GlobalExceptionHandler()).build();
        mvc.perform(put("/api/restaurants/1/announcements/10")
                        .contentType("application/json")
                        .content("{\"content\":\"Changed\",\"positionIds\":[2]}"))
                .andExpect(status().isMethodNotAllowed());
        verifyNoInteractions(messages, inbox, push);
    }

    @Test void emptyAudienceIsRejectedBeforeSavingOrEnqueuingPush() {
        var restaurant = Restaurant.builder().id(1L).build();
        when(restaurants.findLifecycleMutex(1L)).thenReturn(Optional.of(restaurant));
        when(users.findById(7L)).thenReturn(Optional.of(User.builder().id(7L).build()));
        when(positions.findAllById(List.of(2L))).thenReturn(List.of(
                Position.builder().id(2L).restaurant(restaurant).build()));
        when(members.findActiveWithUserAndPositionByRestaurantIdAndPositionIdIn(1L, List.of(2L)))
                .thenReturn(List.of());

        assertThrows(BadRequestException.class,
                () -> service.create(1L, 7L, new AnnouncementRequest("Message", AnnouncementAudience.POSITIONS, List.of(2L), List.of(), java.util.UUID.randomUUID())));
        verify(security).assertAtLeastManager(7L, 1L);
        verifyNoInteractions(inbox, push);
    }

    @Test void manualDeletionCancelsPendingPushBeforeRemovingInboxMessage() {
        when(restaurants.findLifecycleMutex(1L)).thenReturn(Optional.of(Restaurant.builder().id(1L).build()));
        var message = InboxMessage.builder().id(10L).type(InboxMessageType.ANNOUNCEMENT).build();
        when(messages.findByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(message));

        service.delete(1L, 7L, 10L);

        var order = inOrder(security, push, messages);
        order.verify(security).assertAtLeastManager(7L, 1L);
        order.verify(messages).findByIdAndRestaurantId(10L, 1L);
        order.verify(push).cancelUnsentForInboxMessage(1L, 10L);
        order.verify(messages).delete(message);
    }

    @Test void anotherMessageTypeCannotBeDeletedAsAnAnnouncement() {
        when(restaurants.findLifecycleMutex(1L)).thenReturn(Optional.of(Restaurant.builder().id(1L).build()));
        when(messages.findByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(
                InboxMessage.builder().type(InboxMessageType.EVENT).build()));
        assertThrows(NotFoundException.class, () -> service.delete(1L, 7L, 10L));
        verifyNoInteractions(push);
        verify(messages, never()).delete(any());
    }

    @Test void scheduledRetentionOnlyDeletesEventsAndBirthdays() {
        var recipients = mock(InboxRecipientRepository.class);
        var time = mock(RestaurantTimeService.class);
        var restaurant = Restaurant.builder().id(1L).timezone("UTC").build();
        var now = Instant.parse("2026-10-09T02:45:00Z");
        when(restaurants.findAll()).thenReturn(List.of(restaurant));
        when(time.nowInstant()).thenReturn(now);
        when(time.zoneFor(restaurant)).thenReturn(ZoneId.of("UTC"));
        when(time.today(restaurant)).thenReturn(LocalDate.of(2026, 10, 9));
        when(messages.findEventIdsForCleanup(InboxMessageType.EVENT, 1L, now.minusSeconds(30 * 86400L)))
                .thenReturn(List.of(20L));
        when(messages.findBirthdayIdsForCleanup(InboxMessageType.BIRTHDAY, 1L, LocalDate.of(2026, 10, 2)))
                .thenReturn(List.of(30L));

        new InboxRetentionJob(messages, recipients, restaurants, time).cleanupInbox();

        verify(messages).findEventIdsForCleanup(InboxMessageType.EVENT, 1L, now.minusSeconds(30 * 86400L));
        verify(messages).findBirthdayIdsForCleanup(InboxMessageType.BIRTHDAY, 1L, LocalDate.of(2026, 10, 2));
        verify(messages).deleteAllByIdInBatch(List.of(20L));
        verify(messages).deleteAllByIdInBatch(List.of(30L));
        verifyNoMoreInteractions(messages);
    }
}
