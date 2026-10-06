package ru.staffly.member.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.Lock;
import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.List;
import java.util.Optional;
import java.util.Set;

public interface RestaurantMemberRepository extends JpaRepository<RestaurantMember, Long> {

    @EntityGraph(attributePaths = "position")
    Optional<RestaurantMember> findByIdAndEndedAtIsNull(Long id);

    @Query("""
           select m from RestaurantMember m
           join fetch m.user
           left join fetch m.position
           join fetch m.restaurant
           where m.id = :memberId and m.restaurant.id = :restaurantId and m.endedAt is null
           """)
    Optional<RestaurantMember> findWithUserAndPositionByIdAndRestaurantId(@Param("memberId") Long memberId,
                                                                           @Param("restaurantId") Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select m from RestaurantMember m where m.id = :memberId and m.restaurant.id = :restaurantId and m.endedAt is null")
    Optional<RestaurantMember> findForUpdateByIdAndRestaurantId(@Param("memberId") Long memberId,
                                                                 @Param("restaurantId") Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
           select m from RestaurantMember m
           where m.restaurant.id = :restaurantId and m.id in :memberIds and m.endedAt is null
           order by m.id asc
           """)
    List<RestaurantMember> findForUpdateByRestaurantIdAndIdInOrderByIdAsc(@Param("restaurantId") Long restaurantId,
                                                                           @Param("memberIds") List<Long> memberIds);

    @Query("""
           select m from RestaurantMember m
           join fetch m.position
           where m.user.id = :userId and m.restaurant.id = :restaurantId and m.endedAt is null
           """)
    Optional<RestaurantMember> findActiveByUserIdAndRestaurantId(Long userId, Long restaurantId);

    @Query("""
           select m from RestaurantMember m
           join fetch m.user u
           join fetch m.position
           where u.id = :userId
             and m.restaurant.id = :restaurantId and m.endedAt is null
           """)
    Optional<RestaurantMember> findActiveWithUserByUserIdAndRestaurantId(Long userId, Long restaurantId);

    @EntityGraph(attributePaths = "position")
    List<RestaurantMember> findByRestaurantIdAndEndedAtIsNull(Long restaurantId);

    @Query("""
           select m from RestaurantMember m
           join fetch m.user u
           where m.restaurant.id = :restaurantId
             and u.id in :userIds and m.endedAt is null
           """)
    List<RestaurantMember> findActiveByRestaurantIdAndUserIdIn(Long restaurantId, Set<Long> userIds);

    @Query("""
           select distinct m from RestaurantMember m
           left join fetch m.position p
           left join fetch p.specializations
           where m.user.id = :userId and m.restaurant.id = :restaurantId and m.endedAt is null
           """)
    Optional<RestaurantMember> findActiveByUserIdAndRestaurantIdWithPosition(Long userId, Long restaurantId);

    @Query("""
           select m from RestaurantMember m
           join fetch m.user u
           where m.restaurant.id = :restaurantId and m.endedAt is null
           """)
    List<RestaurantMember> findActiveWithUserByRestaurantId(Long restaurantId);

    List<RestaurantMember> findByRestaurantIdAndPositionIdInAndEndedAtIsNull(Long restaurantId, List<Long> positionIds);

    @Query("""
           select m from RestaurantMember m
           left join fetch m.user u
           left join fetch m.position p
           where m.id in :memberIds and m.endedAt is null
           """)
    List<RestaurantMember> findWithUserAndPositionByIdIn(@Param("memberIds") Set<Long> memberIds);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.user u
           join fetch m.position p
           where m.restaurant.id = :restaurantId
             and p.id in :positionIds and m.endedAt is null
           """)
    List<RestaurantMember> findActiveWithUserAndPositionByRestaurantIdAndPositionIdIn(@Param("restaurantId") Long restaurantId, @Param("positionIds") List<Long> positionIds);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.user u
           left join fetch m.position p
           left join fetch p.specializations
           where m.restaurant.id = :restaurantId and m.endedAt is null
           """)
    List<RestaurantMember> findActiveWithUserAndPositionByRestaurantId(Long restaurantId);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.user u
           left join fetch m.position p
           where m.restaurant.id = :restaurantId
             and p.id = :positionId and m.endedAt is null
           """)
    List<RestaurantMember> findAnalyticsEmployeesByRestaurantIdAndPositionId(Long restaurantId, Long positionId);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.user u
           left join fetch m.position p
           where m.restaurant.id = :restaurantId and m.endedAt is null
             and (
                  lower(coalesce(u.firstName, '')) like concat('%', :query, '%')
                  or lower(coalesce(u.lastName, '')) like concat('%', :query, '%')
                  or lower(concat(coalesce(u.firstName, ''), ' ', coalesce(u.lastName, ''))) like concat('%', :query, '%')
                  or lower(concat(coalesce(u.lastName, ''), ' ', coalesce(u.firstName, ''))) like concat('%', :query, '%')
             )
           """)
    List<RestaurantMember> findAnalyticsEmployeesByRestaurantIdAndQuery(Long restaurantId, String query);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.user u
           left join fetch m.position p
           where m.restaurant.id = :restaurantId
             and p.id = :positionId and m.endedAt is null
             and (
                  lower(coalesce(u.firstName, '')) like concat('%', :query, '%')
                  or lower(coalesce(u.lastName, '')) like concat('%', :query, '%')
                  or lower(concat(coalesce(u.firstName, ''), ' ', coalesce(u.lastName, ''))) like concat('%', :query, '%')
                  or lower(concat(coalesce(u.lastName, ''), ' ', coalesce(u.firstName, ''))) like concat('%', :query, '%')
             )
           """)
    List<RestaurantMember> findAnalyticsEmployeesByRestaurantIdAndPositionIdAndQuery(Long restaurantId, Long positionId, String query);

    @Query("select count(m) from RestaurantMember m where m.restaurant.id = :restaurantId and m.endedAt is null and m.position.level = :role")
    long countActiveByRestaurantIdAndPositionLevel(Long restaurantId, RestaurantRole role);

    boolean existsByRestaurantId(Long restaurantId);

    boolean existsByRestaurantIdAndUserIdAndEndedAtIsNull(Long restaurantId, Long userId);

    boolean existsByPositionIdAndEndedAtIsNull(Long positionId);

    @Query("""
           select m from RestaurantMember m
           where m.restaurant.id = :restaurantId
             and m.endedAt is null
             and m.position.level in ('ADMIN', 'MANAGER')
           """)
    List<RestaurantMember> findAdmins(Long restaurantId);

    List<RestaurantMember> findByUserIdAndEndedAtIsNull(Long userId);

    @Query("""
           select distinct m from RestaurantMember m
           join fetch m.restaurant r
           left join fetch m.position p
           left join fetch p.specializations
           where m.user.id = :userId and m.endedAt is null
           order by r.id asc
           """)
    List<RestaurantMember> findActiveMembershipsByUserIdWithRestaurantAndPosition(Long userId);
}
