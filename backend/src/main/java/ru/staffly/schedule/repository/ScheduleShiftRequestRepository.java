package ru.staffly.schedule.repository;

import jakarta.persistence.LockModeType;
import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Lock;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.ScheduleShiftRequest;
import ru.staffly.schedule.model.ScheduleShiftRequestStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ScheduleShiftRequestRepository extends JpaRepository<ScheduleShiftRequest, Long> {

    List<ScheduleShiftRequest> findByScheduleIdOrderByCreatedAtDesc(Long scheduleId);

    Optional<ScheduleShiftRequest> findByIdAndScheduleRestaurantId(Long id, Long restaurantId);

    @Query("select r.schedule.id from ScheduleShiftRequest r where r.id = :id and r.schedule.restaurant.id = :restaurantId")
    Optional<Long> findScheduleIdByIdAndRestaurantId(@Param("id") Long id,
                                                      @Param("restaurantId") Long restaurantId);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ScheduleShiftRequest r where r.id = :id and r.schedule.restaurant.id = :restaurantId")
    Optional<ScheduleShiftRequest> findForUpdateByIdAndRestaurantId(@Param("id") Long id,
                                                                    @Param("restaurantId") Long restaurantId);

    boolean existsByScheduleIdAndStatus(Long scheduleId, ScheduleShiftRequestStatus status);

    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select r from ScheduleShiftRequest r where r.schedule.id = :scheduleId and r.status = :status order by r.id")
    List<ScheduleShiftRequest> findForUpdateByScheduleIdAndStatus(@Param("scheduleId") Long scheduleId,
                                                                  @Param("status") ScheduleShiftRequestStatus status);

    @Query("""
            select case when count(r) > 0 then true else false end
            from ScheduleShiftRequest r
            where r.fromRow.id = :rowId or r.toRow.id = :rowId
            """)
    boolean existsByFromRowIdOrToRowId(Long rowId);

    @Query("""
            select r from ScheduleShiftRequest r
            where r.schedule.id = :scheduleId
              and r.fromMemberId = :memberId
              and r.dayFrom = :dayFrom
              and r.status in :statuses
            """)
    Optional<ScheduleShiftRequest> findActiveByScheduleAndFromMemberAndDay(Long scheduleId,
                                                                           Long memberId,
                                                                           LocalDate dayFrom,
                                                                           List<ScheduleShiftRequestStatus> statuses);

    @Query("""
            select case when count(r) > 0 then true else false end
            from ScheduleShiftRequest r
            where r.schedule.id = :scheduleId
              and r.status = :status
              and (r.fromMemberId = :memberId or r.toMemberId = :memberId)
            """)
    boolean existsActiveForMember(Long scheduleId,
                                  ScheduleShiftRequestStatus status,
                                  Long memberId);
}
