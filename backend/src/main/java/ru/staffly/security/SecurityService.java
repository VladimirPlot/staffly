package ru.staffly.security;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;

@Component("securityService") // имя для SpEL в @PreAuthorize
@RequiredArgsConstructor
public class SecurityService {

    private final RestaurantMemberRepository members;

    private boolean isCreator() {
        var a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream()
                .anyMatch(gr -> "ROLE_CREATOR".equals(gr.getAuthority()));
    }

    /** Есть ли членство в ресторане */
    public boolean isMember(Long userId, Long restaurantId) {
        if (isCreator()) return true;
        return members.findByUserIdAndRestaurantId(userId, restaurantId).isPresent();
    }

    /** Является ли ADMIN */
    public boolean isAdmin(Long userId, Long restaurantId) {
        if (isCreator()) return true;
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(RestaurantMember::getRole)
                .map(role -> role == RestaurantRole.ADMIN)
                .orElse(false);
    }

    /** ADMIN или MANAGER */
    public boolean hasAtLeastManager(Long userId, Long restaurantId) {
        if (isCreator()) return true;
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(RestaurantMember::getRole)
                .map(role -> role == RestaurantRole.ADMIN || role == RestaurantRole.MANAGER)
                .orElse(false);
    }

    /* assert-методы для сервисов */
    public void assertMember(Long userId, Long restaurantId) {
        if (!isMember(userId, restaurantId)) throw new ForbiddenException("Not a member"); }
    public void assertAtLeastManager(Long userId, Long restaurantId) {
        if (!hasAtLeastManager(userId, restaurantId)) throw new ForbiddenException("Manager or Admin required"); }
    public void assertAdmin(Long userId, Long restaurantId) {
        if (!isAdmin(userId, restaurantId)) throw new ForbiddenException("Admin required"); }
}