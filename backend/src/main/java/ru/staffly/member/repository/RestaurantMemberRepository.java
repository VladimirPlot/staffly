package ru.staffly.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.List;
import java.util.Optional;

public interface RestaurantMemberRepository extends JpaRepository<RestaurantMember, Long> {

    Optional<RestaurantMember> findByUserIdAndRestaurantId(Long userId, Long restaurantId);

    List<RestaurantMember> findByRestaurantId(Long restaurantId);

    long countByRestaurantIdAndRole(Long restaurantId, RestaurantRole role);

    boolean existsByRestaurantIdAndUserId(Long restaurantId, Long userId);

    // ADMIN или MANAGER
    @Query("""
           select m from RestaurantMember m
           where m.restaurant.id = :restaurantId
             and (m.role = 'ADMIN' or m.role = 'MANAGER')
           """)
    List<RestaurantMember> findAdmins(Long restaurantId);
}