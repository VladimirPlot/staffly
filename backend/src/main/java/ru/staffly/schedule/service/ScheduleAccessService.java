package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.security.SecurityService;

@Service
@RequiredArgsConstructor
public class ScheduleAccessService {

    private final RestaurantMemberRepository members;
    private final SecurityService securityService;

    public boolean canManageSchedules(Long userId, Long restaurantId) {
        if (securityService.hasAtLeastManager(userId, restaurantId)) {
            return true;
        }
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .map(RestaurantMember::getRole)
                .map(role -> role == RestaurantRole.ADMIN || role == RestaurantRole.MANAGER)
                .orElse(false);
    }

    public void assertCanManageSchedules(Long userId, Long restaurantId) {
        if (!canManageSchedules(userId, restaurantId)) {
            throw new ForbiddenException("Недостаточно прав для управления графиками");
        }
    }

    public boolean canViewSchedule(Long userId, Schedule schedule) {
        if (canManageSchedules(userId, schedule.getRestaurant().getId())) {
            return true;
        }
        return members.findByUserIdAndRestaurantId(userId, schedule.getRestaurant().getId())
                .map(member -> member.getRole() == RestaurantRole.STAFF
                        && member.getPosition() != null
                        && schedule.getPositionIds().contains(member.getPosition().getId()))
                .orElse(false);
    }

    public void assertCanViewSchedule(Long userId, Schedule schedule) {
        if (!canViewSchedule(userId, schedule)) {
            throw new ForbiddenException("Нет доступа к этому графику");
        }
    }

    public void assertCanManageSchedule(Long userId, Schedule schedule) {
        assertCanManageSchedules(userId, schedule.getRestaurant().getId());
    }
}
