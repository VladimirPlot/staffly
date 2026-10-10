package ru.staffly.restaurant.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import ru.staffly.restaurant.model.Restaurant;

import java.util.Optional;

public interface RestaurantRepository extends JpaRepository<Restaurant, Long> {
    Optional<Restaurant> findByCode(String code);

    /** Global lifecycle mutex. Always acquire before membership/module locks. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from Restaurant r where r.id = :restaurantId")
    Optional<Restaurant> findLifecycleMutex(@Param("restaurantId") Long restaurantId);
}
