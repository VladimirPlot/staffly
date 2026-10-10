package ru.staffly.checklist.lifecycle;

import org.junit.jupiter.api.Test;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.repository.ChecklistItemRepository;
import ru.staffly.checklist.repository.ChecklistRepository;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.model.RestaurantMember;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ChecklistTerminationLockTest {
    @Test void waitsForOrderedParentsBeforeReleasingReservationsExactlyOnce() {
        var items = mock(ChecklistItemRepository.class);
        var parents = mock(ChecklistRepository.class);
        when(items.findReservedChecklistIds(17L)).thenReturn(List.of(20L, 10L, 20L));
        when(parents.findDetailedByIdForUpdate(anyLong())).thenAnswer(invocation ->
                Optional.of(Checklist.builder().id(invocation.getArgument(0)).build()));
        when(items.releaseActiveReservationsForMember(17L)).thenReturn(3);
        var context = new TerminationApplyContext(1L, 999L, RestaurantMember.builder().id(17L).build(),
                TerminationMode.FORCED, Instant.now(), UUID.randomUUID());
        var result = new ChecklistTerminationLifecycleHandler(items, parents).applyBeforeTermination(context,
                new NoTerminationModuleDecision(LifecycleModule.CHECKLIST));
        assertEquals(3, result.releasedReservations());
        var order = inOrder(items, parents);
        order.verify(items).findReservedChecklistIds(17L);
        order.verify(parents).findDetailedByIdForUpdate(10L);
        order.verify(parents).findDetailedByIdForUpdate(20L);
        order.verify(items).releaseActiveReservationsForMember(17L);
        verifyNoMoreInteractions(items, parents);
    }
}
