package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.JpaRepository;
import org.springframework.data.jpa.repository.Query;
import ru.staffly.schedule.model.ScheduleShiftRequest;
import ru.staffly.schedule.model.ScheduleShiftRequestStatus;

import java.time.LocalDate;
import java.util.List;
import java.util.Optional;

public interface ScheduleShiftRequestRepository extends JpaRepository<ScheduleShiftRequest, Long> {

    List<ScheduleShiftRequest> findByScheduleIdOrderByCreatedAtDesc(Long scheduleId);

    Optional<ScheduleShiftRequest> findByIdAndScheduleRestaurantId(Long id, Long restaurantId);

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
}