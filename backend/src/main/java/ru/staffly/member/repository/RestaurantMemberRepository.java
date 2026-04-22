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

    @Query("""
           select distinct m from RestaurantMember m
           left join fetch m.position p
           left join fetch p.specializations
           where m.user.id = :userId and m.restaurant.id = :restaurantId
           """)
    Optional<RestaurantMember> findByUserIdAndRestaurantIdWithPosition(Long userId, Long restaurantId);

    @Query("""
           select m from RestaurantMember m
           join fetch m.user u
           where m.restaurant.id = :restaurantId
           """)
    List<RestaurantMember> findWithUserByRestaurantId(Long restaurantId);

    List<RestaurantMember> findByRestaurantIdAndPositionIdIn(Long restaurantId, List<Long> positionIds);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.user u
           left join fetch m.position p
           left join fetch p.specializations
           where m.restaurant.id = :restaurantId
           """)
    List<RestaurantMember> findWithUserAndPositionByRestaurantId(Long restaurantId);

    // Не используем u.fullName в JPQL: legacy БД могла содержать bytea в name-колонках users.
    @Query("""
       select distinct m from RestaurantMember m
       join fetch m.user u
       left join fetch m.position p
       where m.restaurant.id = :restaurantId
         and (:positionId is null or p.id = :positionId)
         and (:query is null
              or lower(coalesce(u.firstName, '')) like concat('%', :query, '%')
              or lower(coalesce(u.lastName, '')) like concat('%', :query, '%')
              or lower(concat(coalesce(u.firstName, ''), ' ', coalesce(u.lastName, ''))) like concat('%', :query, '%')
              or lower(concat(coalesce(u.lastName, ''), ' ', coalesce(u.firstName, ''))) like concat('%', :query, '%'))
       """)
    List<RestaurantMember> findWithUserAndPositionByRestaurantIdAndFilters(Long restaurantId, Long positionId, String query);

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
           select distinct m from RestaurantMember m
           join fetch m.restaurant r
           left join fetch m.position p
           left join fetch p.specializations
           where m.user.id = :userId
           order by r.id asc
           """)
    List<RestaurantMember> findMembershipsByUserIdWithRestaurantAndPosition(Long userId);
}
