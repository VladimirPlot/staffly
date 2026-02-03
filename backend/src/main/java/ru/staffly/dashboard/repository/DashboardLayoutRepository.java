package ru.staffly.dashboard.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.dashboard.model.DashboardLayout;

import java.util.Optional;

public interface DashboardLayoutRepository extends JpaRepository<DashboardLayout, Long> {
    Optional<DashboardLayout> findByUserIdAndRestaurantId(Long userId, Long restaurantId);
}