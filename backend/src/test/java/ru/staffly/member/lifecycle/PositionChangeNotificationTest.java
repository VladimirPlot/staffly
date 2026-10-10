package ru.staffly.member.lifecycle;

import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import ru.staffly.inbox.service.*;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.member.dto.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.PositionChangeNotificationService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.dto.AppliedScheduleOwnershipTransfer;
import ru.staffly.task.lifecycle.TaskTerminationResult;
import ru.staffly.user.model.User;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PositionChangeNotificationTest {
    @Test void notificationsAreDeferredAndPushFailureCannotEscapeAfterCommit() {
        var writer = mock(BusinessNotificationBatchWriter.class);
        var afterCommit = new BusinessNotificationAfterCommitService(writer);
        var restaurant = Restaurant.builder().id(1L).build();
        var recipient = RestaurantMember.builder().id(17L).user(User.builder().id(117L).build()).build();
        var commands = List.of(new BusinessNotificationCommand(restaurant, UUID.randomUUID(), recipient,
                User.builder().id(999L).build(), BusinessNotificationKind.POSITION_CHANGE, "Changed", "Changed", null, null));
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            afterCommit.submit(commands);
            verifyNoInteractions(writer);
            doThrow(new IllegalStateException("Push unavailable")).when(writer).write(commands);
            assertDoesNotThrow(() -> TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCommit()));
            verify(writer).write(commands);
        } finally {
            TransactionSynchronizationManager.clear();
        }
    }

    @Test void rolledBackOperationDoesNotPublishNotifications() {
        var writer = mock(BusinessNotificationBatchWriter.class);
        var afterCommit = new BusinessNotificationAfterCommitService(writer);
        var recipient = RestaurantMember.builder().id(17L).build();
        var command = new BusinessNotificationCommand(Restaurant.builder().id(1L).build(), UUID.randomUUID(), recipient,
                User.builder().id(999L).build(), BusinessNotificationKind.POSITION_CHANGE, "Changed", null, null, null);
        TransactionSynchronizationManager.initSynchronization();
        TransactionSynchronizationManager.setActualTransactionActive(true);
        try {
            afterCommit.submit(List.of(command));
            TransactionSynchronizationManager.getSynchronizations().forEach(s -> s.afterCompletion(
                    org.springframework.transaction.support.TransactionSynchronization.STATUS_ROLLED_BACK));
            verifyNoInteractions(writer);
        } finally {
            TransactionSynchronizationManager.clear();
        }
    }

    @SuppressWarnings({"rawtypes", "unchecked"})
    @Test void ownerEffectsAndTransfersAreAggregatedWithOneOperationId() {
        var members = mock(RestaurantMemberRepository.class);
        var afterCommit = mock(BusinessNotificationAfterCommitService.class);
        var restaurant = Restaurant.builder().id(1L).build();
        var subject = RestaurantMember.builder().id(17L).restaurant(restaurant).user(User.builder().id(117L).fullName("Ivan").build()).build();
        var recipient = RestaurantMember.builder().id(18L).restaurant(restaurant).user(User.builder().id(118L).build()).build();
        when(members.findActiveByRestaurantIdAndUserIdIn(1L, Set.of(118L))).thenReturn(List.of(recipient));
        when(members.findActiveByUserIdAndRestaurantId(118L, 1L)).thenReturn(Optional.of(recipient));
        when(members.findByIdAndEndedAtIsNull(18L)).thenReturn(Optional.of(recipient));
        var operation = UUID.randomUUID();
        new PositionChangeNotificationService(members, afterCommit).submit(subject, User.builder().id(999L).build(), operation,
                "Manager", "Waiter", List.of(new AppliedPositionChangeScheduleEffect(10L, "Schedule", 118L, 17L,
                        EnumSet.of(PositionChangeScheduleEffectType.AUTO_BUILD_RESULT_INVALIDATED), null, 0)), List.of(),
                List.of(new AppliedScheduleOwnershipTransfer(10L, "Schedule", 118L)), List.of(),
                List.of(new TaskTerminationResult.Transfer(11L, "Task 1", 18L), new TaskTerminationResult.Transfer(12L, "Task 2", 18L)));
        ArgumentCaptor<List> captor = ArgumentCaptor.forClass(List.class);
        verify(afterCommit).submit(captor.capture());
        List<BusinessNotificationCommand> commands = captor.getValue();
        assertTrue(commands.stream().allMatch(c -> operation.equals(c.operationId())));
        assertEquals(1, commands.stream().filter(c -> c.kind() == BusinessNotificationKind.SCHEDULE).count());
        var schedule = commands.stream().filter(c -> c.kind() == BusinessNotificationKind.SCHEDULE).findFirst().orElseThrow();
        assertTrue(schedule.inboxText().contains("Вам передали"));
        assertTrue(schedule.inboxText().contains("Изменения в графиках"));
        assertEquals(1, commands.stream().filter(c -> c.kind() == BusinessNotificationKind.TASK_RESPONSIBILITY).count());
    }
}
