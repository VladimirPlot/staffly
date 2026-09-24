package ru.staffly.schedule.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.EntityGraph;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ScheduleRepository extends JpaRepository<Schedule, Long> {

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position"})
    List<Schedule> findByRestaurantIdOrderByCreatedAtDesc(Long restaurantId);

    @EntityGraph(attributePaths = {"rows", "ownerMember", "ownerMember.user", "ownerMember.position", "createdByUser"})
    Optional<Schedule> findByIdAndRestaurantId(Long id, Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select s from Schedule s where s.id = :id and s.restaurant.id = :restaurantId")
    Optional<Schedule> findForUpdateByIdAndRestaurantId(@Param("id") Long id,
                                                         @Param("restaurantId") Long restaurantId);

    /** Locks multiple aggregates in the global deterministic schedule-id order. */
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("""
            select s from Schedule s
            where s.restaurant.id = :restaurantId and s.id in :ids
            order by s.id asc
            """)
    List<Schedule> findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(@Param("restaurantId") Long restaurantId,
                                                                      @Param("ids") List<Long> ids);

    @Query("select p.id from Schedule s join s.positions p where s.id = :id and s.restaurant.id = :restaurantId order by p.id")
    List<Long> findPositionIdsByIdAndRestaurantId(@Param("id") Long id,
                                                   @Param("restaurantId") Long restaurantId);

    boolean existsByPreferenceBuildTemplateIdAndStatus(Long templateId, ScheduleStatus status);

    /** Authoritative template linkage used by the read-only template impact plan. */
    List<Schedule> findByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(Long restaurantId, Long templateId);

    @Query("select s.id from Schedule s where s.restaurant.id = :restaurantId and s.preferenceBuildTemplate.id = :templateId order by s.id")
    List<Long> findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(
            @Param("restaurantId") Long restaurantId, @Param("templateId") Long templateId);

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position", "ownerUser"})
    List<Schedule> findByRestaurantIdAndOwnerUserIdAndEndDateGreaterThanEqualOrderByStartDateAsc(
            Long restaurantId,
            Long ownerUserId,
            LocalDate endDate
    );

    @Query("select s.title from Schedule s where s.restaurant.id = :restaurantId")
    List<String> findTitlesByRestaurantId(@Param("restaurantId") Long restaurantId);

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position"})
    @Query("""
            select distinct s from Schedule s join s.positions p
            where s.restaurant.id = :restaurantId and p.id = :positionId
            order by s.createdAt desc
            """)
    List<Schedule> findByRestaurantIdAndPositionId(@Param("restaurantId") Long restaurantId,
                                                   @Param("positionId") Long positionId);

    @EntityGraph(attributePaths = {"positions", "preferenceBuildTemplate", "preferenceShiftOptionSnapshots",
            "preferenceShiftOptionSnapshots.positionIds"})
    @Query("""
            select distinct s from Schedule s join s.positions p
            where s.restaurant.id = :restaurantId and p.id = :positionId and s.endDate >= :fromDate
            order by s.id asc
            """)
    List<Schedule> findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(
            @Param("restaurantId") Long restaurantId, @Param("positionId") Long positionId,
            @Param("fromDate") LocalDate fromDate);

    @EntityGraph(attributePaths = {"positions", "ownerMember", "ownerMember.user", "ownerMember.position"})
    @Query("""
            select distinct s from Schedule s join ScheduleParticipation sp on sp.schedule = s
            where s.restaurant.id = :restaurantId and sp.member.id = :memberId
            order by s.createdAt desc
            """)
    List<Schedule> findByRestaurantIdAndParticipantMemberId(@Param("restaurantId") Long restaurantId,
                                                            @Param("memberId") Long memberId);

    @EntityGraph(attributePaths = {"positions"})
    @Query("""
            select distinct s from Schedule s join s.rows r
            where s.restaurant.id = :restaurantId and r.memberId = :memberId
            order by s.createdAt desc
            """)
    List<Schedule> findByRestaurantIdAndRowMemberId(@Param("restaurantId") Long restaurantId,
                                                    @Param("memberId") Long memberId);

    @EntityGraph(attributePaths = {"positions"})
    @Query("""
            select distinct s from Schedule s join SchedulePreferenceSubmission submission on submission.schedule = s
            where s.restaurant.id = :restaurantId and submission.member.id = :memberId
            order by s.createdAt desc
            """)
    List<Schedule> findByRestaurantIdAndSubmissionMemberId(@Param("restaurantId") Long restaurantId,
                                                           @Param("memberId") Long memberId);
}
