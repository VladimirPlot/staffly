package ru.staffly.dictionary.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.repository.query.Param;
import ru.staffly.dictionary.model.Position;

import java.util.List;

public interface PositionRepository extends JpaRepository<Position, Long> {

    @Lock(LockModeType.PESSIMISTIC_READ)
    @Query("select p from Position p where p.id = :id and p.restaurant.id = :restaurantId")
    java.util.Optional<Position> findForShareByIdAndRestaurantId(@Param("id") Long id,
                                                                  @Param("restaurantId") Long restaurantId);

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
