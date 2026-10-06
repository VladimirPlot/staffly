package ru.staffly.restaurant.service;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.restaurant.service.impl.RestaurantServiceImpl;
import java.util.Optional;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RestaurantDeletionLifecycleTest {
    @Test void anyEmploymentHistoryBlocksCascadeEvenWhenNoOtherActiveEmployeeExists() {
        var restaurants = mock(RestaurantRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        when(restaurants.findLifecycleMutex(1L)).thenReturn(Optional.of(Restaurant.builder().id(1L).build()));
        when(members.existsByRestaurantId(1L)).thenReturn(true);
        var service = new RestaurantServiceImpl(restaurants, members, mock(PositionRepository.class));
        assertThrows(ConflictException.class, () -> service.delete(1L, 100L));
        verify(restaurants, never()).delete(any());
        var order = inOrder(restaurants, members);
        order.verify(restaurants).findLifecycleMutex(1L);
        order.verify(members).existsByRestaurantId(1L);
    }

    @Test void restaurantWithoutAnyEmploymentPeriodCanStillBeDeleted() {
        var restaurants = mock(RestaurantRepository.class);
        var members = mock(RestaurantMemberRepository.class);
        var restaurant = Restaurant.builder().id(1L).build();
        when(restaurants.findLifecycleMutex(1L)).thenReturn(Optional.of(restaurant));
        new RestaurantServiceImpl(restaurants, members, mock(PositionRepository.class)).delete(1L, 100L);
        verify(restaurants).delete(restaurant);
    }
}
