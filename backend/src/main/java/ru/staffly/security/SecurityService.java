package ru.staffly.security;

import lombok.RequiredArgsConstructor;
import org.springframework.security.core.context.SecurityContextHolder;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.restaurant.model.RestaurantRole;

@Component("securityService") // имя для SpEL в @PreAuthorize
@RequiredArgsConstructor
public class SecurityService {

    private final RestaurantMemberRepository members;
    private final RestaurantRepository restaurants;

    private boolean isCreator() {
        var a = SecurityContextHolder.getContext().getAuthentication();
        return a != null && a.getAuthorities().stream()
                .anyMatch(gr -> "ROLE_CREATOR".equals(gr.getAuthority()));
    }

    private boolean isLocked(Long restaurantId) {
        return restaurants.findById(restaurantId)
                .map(r -> r.isLocked())
                .orElse(false);
    }

    /** Есть ли членство в ресторане */
    public boolean isMember(Long userId, Long restaurantId) {
        if (isCreator()) return true;
        if (isLocked(restaurantId)) return false;
        return members.findByUserIdAndRestaurantId(userId, restaurantId).isPresent();
    }

    /** Является ли ADMIN */
    public boolean isAdmin(Long userId, Long restaurantId) {
        if (isCreator()) return true;
        if (isLocked(restaurantId)) return false;
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(RestaurantMember::getRole)
                .map(role -> role == RestaurantRole.ADMIN)
                .orElse(false);
    }

    /** ADMIN или MANAGER */
    public boolean hasAtLeastManager(Long userId, Long restaurantId) {
        if (isCreator()) return true;
        if (isLocked(restaurantId)) return false;
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(RestaurantMember::getRole)
                .map(role -> role == RestaurantRole.ADMIN || role == RestaurantRole.MANAGER)
                .orElse(false);
    }

    /* assert-методы для сервисов */
    public void assertMember(Long userId, Long restaurantId) {
        if (!isCreator() && isLocked(restaurantId)) throw new ForbiddenException("Restaurant is locked");
        if (!isMember(userId, restaurantId)) throw new ForbiddenException("Not a member"); }
    public void assertAtLeastManager(Long userId, Long restaurantId) {
        if (!isCreator() && isLocked(restaurantId)) throw new ForbiddenException("Restaurant is locked");
        if (!hasAtLeastManager(userId, restaurantId)) throw new ForbiddenException("Manager or Admin required"); }
    public void assertAdmin(Long userId, Long restaurantId) {
        if (!isCreator() && isLocked(restaurantId)) throw new ForbiddenException("Restaurant is locked");
        if (!isAdmin(userId, restaurantId)) throw new ForbiddenException("Admin required"); }

    public void assertRestaurantUnlocked(Long userId, Long restaurantId) {
        if (!isCreator() && isLocked(restaurantId)) {
            throw new ForbiddenException("Restaurant is locked");
        }
    }
}