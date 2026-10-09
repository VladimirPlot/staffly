package ru.staffly.announcement;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.mockito.ArgumentCaptor;
import org.springframework.data.domain.PageImpl;
import ru.staffly.announcement.dto.*;
import ru.staffly.announcement.service.AnnouncementService;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.model.InboxMessage;
import ru.staffly.inbox.model.InboxMessageType;
import ru.staffly.inbox.model.InboxRecipient;
import ru.staffly.inbox.model.InboxState;
import ru.staffly.inbox.repository.InboxMessageRepository;
import ru.staffly.inbox.repository.InboxRecipientRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.inbox.service.InboxService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.push.service.PushEnqueueService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.List;
import java.util.Optional;
import java.util.Map;
import java.time.LocalDate;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class AnnouncementAudienceTest {
    final InboxMessageRepository messages = mock(InboxMessageRepository.class);
    final InboxRecipientRepository receipts = mock(InboxRecipientRepository.class);
    final RestaurantRepository restaurants = mock(RestaurantRepository.class);
    final PositionRepository positions = mock(PositionRepository.class);
    final RestaurantMemberRepository members = mock(RestaurantMemberRepository.class);
    final UserRepository users = mock(UserRepository.class);
    final SecurityService security = mock(SecurityService.class);
    final PushEnqueueService push = mock(PushEnqueueService.class);
    final AnnouncementService service = new AnnouncementService(messages,
            new InboxMessageService(messages, receipts, push), restaurants, positions, members, users,
            security, push, new ObjectMapper());
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final Position managerPosition = Position.builder().id(2L).restaurant(restaurant)
            .name("Менеджер").level(RestaurantRole.MANAGER).build();
    final Position staffPosition = Position.builder().id(3L).restaurant(restaurant).name("Официант").build();
    final User manager = User.builder().id(7L).fullName("Менеджер").build();
    final RestaurantMember sender = RestaurantMember.builder().id(10L).restaurant(restaurant)
            .user(manager).position(managerPosition).build();
    final RestaurantMember first = member(11L, "Иван", staffPosition);
    final RestaurantMember second = member(12L, "Анна", staffPosition);

    @BeforeEach void setup() {
        when(restaurants.findLifecycleMutex(1L)).thenReturn(Optional.of(restaurant));
        when(users.findById(7L)).thenReturn(Optional.of(manager));
        when(positions.findAllById(List.of(3L))).thenReturn(List.of(staffPosition));
        when(members.findActiveWithUserAndPositionByRestaurantId(1L)).thenReturn(List.of(sender, first, second));
        when(members.findActiveWithUserAndPositionByRestaurantIdAndPositionIdIn(1L, List.of(3L)))
                .thenReturn(List.of(first, second));
        when(messages.save(any())).thenAnswer(invocation -> {
            InboxMessage message = invocation.getArgument(0);
            message.setId(100L);
            return message;
        });
    }

    @Test void everyoneIncludesSenderAndManagementWithoutPositionFilter() {
        var result = service.create(1L, 7L, request(AnnouncementAudience.ALL, List.of(), List.of()));
        assertEquals(AnnouncementAudience.ALL, result.audience());
        assertEquals(3, result.recipientCount());
        assertTrue(result.positions().isEmpty());
        assertTrue(result.recipients().isEmpty());
        verify(push).enqueueForMessage(any(), eq(List.of(sender, first, second)));
        verifyNoInteractions(positions);
        var order = inOrder(restaurants, security, members);
        order.verify(restaurants).findLifecycleMutex(1L);
        order.verify(security).assertAtLeastManager(7L, 1L);
        order.verify(members).findActiveWithUserAndPositionByRestaurantId(1L);
    }

    @Test void positionsTargetEveryoneInTheirUnionAndNormalizeDuplicateIds() {
        when(positions.findAllById(List.of(2L, 3L))).thenReturn(List.of(managerPosition, staffPosition));
        when(members.findActiveWithUserAndPositionByRestaurantIdAndPositionIdIn(1L, List.of(2L, 3L)))
                .thenReturn(List.of(sender, first, second));
        var result = service.create(1L, 7L, request(AnnouncementAudience.POSITIONS, List.of(2L, 3L, 2L), List.of()));
        assertEquals(3, result.recipientCount());
        assertEquals(AnnouncementAudience.POSITIONS, result.audience());
        verify(push).enqueueForMessage(any(), eq(List.of(sender, first, second)));
    }

    @Test void specificMembersNarrowTheAudienceAndKeepTheirNamesInHistory() {
        var result = service.create(1L, 7L, request(AnnouncementAudience.MEMBERS, List.of(3L), List.of(11L, 11L)));
        assertEquals(1, result.recipientCount());
        assertEquals(List.of(new AnnouncementMemberDto(11L, "Иван", 3L, "Официант")), result.recipients());
        var message = ArgumentCaptor.forClass(InboxMessage.class);
        verify(push).enqueueForMessage(message.capture(), eq(List.of(first)));

        first.getUser().setFullName("Новое имя");
        first.setPosition(managerPosition);
        staffPosition.setName("Новое название должности");
        when(messages.findByRestaurantIdAndTypeOrderByCreatedAtDesc(eq(1L), any()))
                .thenReturn(List.of(message.getValue()));
        assertEquals("Иван", service.list(1L, 7L).get(0).recipients().get(0).name());
        assertEquals("Официант", service.list(1L, 7L).get(0).recipients().get(0).positionName());
        assertEquals("Официант", service.list(1L, 7L).get(0).positions().get(0).name());
    }

    @ParameterizedTest
    @ValueSource(longs = {10L, 99L})
    void personOutsidePositionsOrMissingFromCurrentRosterRejectsTheWholeSend(long invalidId) {
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L,
                request(AnnouncementAudience.MEMBERS, List.of(3L), List.of(11L, invalidId))));
        verify(messages, never()).save(any());
        verifyNoInteractions(push, receipts);
    }

    @Test void foreignPositionIsRejectedBeforeRecipientLookup() {
        staffPosition.setRestaurant(Restaurant.builder().id(20L).build());
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L,
                request(AnnouncementAudience.POSITIONS, List.of(3L), List.of())));
        verifyNoInteractions(members, push);
    }

    @Test void emptySpecificSelectionNeverFallsBackToEveryone() {
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L,
                request(AnnouncementAudience.MEMBERS, List.of(3L), List.of())));
        verifyNoInteractions(members, push);
    }

    @Test void everyoneWithHiddenFiltersIsRejected() {
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L,
                request(AnnouncementAudience.ALL, List.of(3L), List.of())));
        verifyNoInteractions(members, push);
    }

    @Test void invalidIdsAreRejectedRatherThanSilentlyDropped() {
        assertThrows(BadRequestException.class, () -> service.create(1L, 7L,
                request(AnnouncementAudience.POSITIONS, List.of(3L, -1L), List.of())));
        verifyNoInteractions(members, push);
    }

    @Test void unauthorizedSenderCannotResolveOrSendToAnyone() {
        doThrow(new ForbiddenException("Manager required")).when(security).assertAtLeastManager(7L, 1L);
        assertThrows(ForbiddenException.class, () -> service.create(1L, 7L,
                request(AnnouncementAudience.ALL, List.of(), List.of())));
        verifyNoInteractions(users, members, push);
    }

    @Test void directoryIncludesEveryActiveMemberAndOccupiedInactivePositions() {
        staffPosition.setActive(false);
        var unused = Position.builder().id(4L).restaurant(restaurant).name("Старая").active(false).build();
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(managerPosition, staffPosition, unused));
        var directory = service.audienceOptions(1L, 7L);
        assertEquals(3, directory.members().size());
        assertEquals(2, directory.positions().size());
        assertTrue(directory.positions().stream().anyMatch(position -> position.id().equals(3L)));
        verify(security).assertAtLeastManager(7L, 1L);
    }

    @Test void recipientInboxDoesNotExposeAudienceNamesButKeepsOtherBusinessMetadata() {
        var time = mock(RestaurantTimeService.class);
        when(time.today(1L)).thenReturn(LocalDate.of(2026, 10, 9));
        when(members.findActiveByUserIdAndRestaurantId(7L, 1L)).thenReturn(Optional.of(sender));
        var announcement = InboxMessage.builder().id(1L).restaurant(restaurant).type(InboxMessageType.ANNOUNCEMENT)
                .content("Message").metadata(Map.of("announcement", Map.of("recipients", List.of("Private names")))).build();
        var event = InboxMessage.builder().id(2L).restaurant(restaurant).type(InboxMessageType.EVENT)
                .content("Event").metadata(Map.of("operation", "kept")).build();
        when(receipts.findByState(anyLong(), anyLong(), anyList(), eq(InboxState.UNREAD), any(), any()))
                .thenReturn(new PageImpl<>(List.of(
                        InboxRecipient.builder().message(announcement).member(sender).build(),
                        InboxRecipient.builder().message(event).member(sender).build())));
        var inbox = new InboxService(receipts, members, security, time);
        var items = inbox.list(1L, 7L, InboxService.InboxTypeFilter.ALL, InboxState.UNREAD, 0, 10).items();
        assertTrue(items.get(0).metadata().isEmpty());
        assertEquals(Map.of("operation", "kept"), items.get(1).metadata());
    }

    private AnnouncementRequest request(AnnouncementAudience audience, List<Long> positionIds, List<Long> memberIds) {
        return new AnnouncementRequest("Сообщение", audience, positionIds, memberIds);
    }

    private RestaurantMember member(Long id, String name, Position position) {
        return RestaurantMember.builder().id(id).restaurant(restaurant).position(position)
                .user(User.builder().id(id + 100).fullName(name).build()).build();
    }
}
