package ru.staffly.member.service.policy;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertDoesNotThrow;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberRemovalPolicyServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock SecurityService security;
    private MemberRemovalPolicyService policy;
    private RestaurantMember actor;
    private RestaurantMember other;

    @BeforeEach
    void setUp() {
        policy = new MemberRemovalPolicyService(members, security);
        var restaurant = Restaurant.builder().id(3L).build();
        actor = RestaurantMember.builder().id(7L).restaurant(restaurant).role(RestaurantRole.STAFF)
                .user(User.builder().id(9L).build()).build();
        other = RestaurantMember.builder().id(8L).restaurant(restaurant).role(RestaurantRole.STAFF)
                .user(User.builder().id(10L).build()).build();
        when(members.findByUserIdAndRestaurantId(9L, 3L)).thenReturn(Optional.of(actor));
    }

    @Test
    void staffCanRemoveExactSelf() {
        assertDoesNotThrow(() -> policy.assertCanStartRemoval(3L, 9L, actor));
    }

    @Test
    void staffCannotTargetAnotherMember() {
        assertThrows(ForbiddenException.class, () -> policy.assertCanStartRemoval(3L, 9L, other));
    }
}
