package ru.staffly.dictionary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import ru.staffly.dictionary.model.Shift;

import java.util.List;

public interface ShiftRepository extends JpaRepository<Shift, Long> {

    List<Shift> findByRestaurantIdAndActiveTrue(Long restaurantId);

    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);
}