package ru.staffly.dictionary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.dictionary.model.Position;

import java.util.List;

public interface PositionRepository extends JpaRepository<Position, Long> {

    @Query("""
           select distinct p from Position p
           left join fetch p.specializations
           where p.restaurant.id = :restaurantId
             and p.active = true
           """)
    List<Position> findByRestaurantIdAndActiveTrue(Long restaurantId);

    boolean existsByRestaurantIdAndNameIgnoreCase(Long restaurantId, String name);

    @Query("""
           select distinct p from Position p
           left join fetch p.specializations
           where p.restaurant.id = :restaurantId
           """)
    List<Position> findByRestaurantId(Long restaurantId);
}