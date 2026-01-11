package ru.staffly.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.member.dto.MyMembershipDto;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.List;
import java.util.Optional;

public interface RestaurantMemberRepository extends JpaRepository<RestaurantMember, Long> {

    Optional<RestaurantMember> findByUserIdAndRestaurantId(Long userId, Long restaurantId);

    List<RestaurantMember> findByRestaurantId(Long restaurantId);

    @Query("""
           select m from RestaurantMember m
           join fetch m.user u
           where m.restaurant.id = :restaurantId
           """)
    List<RestaurantMember> findWithUserByRestaurantId(Long restaurantId);

    List<RestaurantMember> findByRestaurantIdAndPositionIdIn(Long restaurantId, List<Long> positionIds);

    long countByRestaurantIdAndRole(Long restaurantId, RestaurantRole role);

    boolean existsByRestaurantIdAndUserIdNot(Long restaurantId, Long userId);

    boolean existsByRestaurantIdAndUserId(Long restaurantId, Long userId);

    // ADMIN или MANAGER
    @Query("""
           select m from RestaurantMember m
           where m.restaurant.id = :restaurantId
             and (m.role = 'ADMIN' or m.role = 'MANAGER')
           """)
    List<RestaurantMember> findAdmins(Long restaurantId);

    List<RestaurantMember> findByUserId(Long userId);

    @Query("""
   select new ru.staffly.member.dto.MyMembershipDto(
     m.restaurant.id,
     m.restaurant.name,
     m.restaurant.description,
     m.restaurant.timezone,
     m.restaurant.locked,
     m.role
   )
   from RestaurantMember m
   where m.user.id = :userId
   order by m.restaurant.id asc
""")
    List<MyMembershipDto> findMembershipsDtoByUserId(Long userId);
}