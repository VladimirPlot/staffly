package ru.staffly.schedule.repository;

import org.springframework.data.jpa.repository.Modifying;
import org.springframework.data.jpa.repository.Query;
import org.springframework.data.repository.Repository;
import org.springframework.data.repository.query.Param;
import ru.staffly.schedule.model.ScheduleBuildMarker;

/** Operational affinity cleanup for soft-ended membership periods. */
public interface ScheduleBuildMarkerMemberRepository extends Repository<ScheduleBuildMarker, Long> {
    @Modifying(flushAutomatically = true)
    @Query(value = "delete from schedule_build_marker_member where restaurant_member_id = :memberId", nativeQuery = true)
    int deleteOperationalAffinity(@Param("memberId") Long memberId);
}
