package ru.staffly.member.model;

import jakarta.persistence.*;
import lombok.*;

import java.time.Instant;

@Entity
@Table(name = "employee_removal_audit")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class EmployeeRemovalAudit {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY) private Long id;
    @Column(name = "restaurant_id", nullable = false) private Long restaurantId;
    @Column(name = "actor_user_id", nullable = false) private Long actorUserId;
    @Column(name = "member_id", nullable = false) private Long memberId;
    @Column(name = "previous_position_id") private Long previousPositionId;
    @Column(name = "occurred_at", nullable = false) private Instant occurredAt;
    @Column(name = "affected_schedule_ids", nullable = false, columnDefinition = "text") private String affectedScheduleIds;
    @Column(name = "removed_participation_count", nullable = false) private int removedParticipationCount;
    @Column(name = "removed_submission_count", nullable = false) private int removedSubmissionCount;
    @Column(name = "invalidated_preference_draft_count", nullable = false) private int invalidatedPreferenceDraftCount;
    @Column(name = "historical_published_row_count", nullable = false) private int historicalPublishedRowCount;
    @Column(name = "cancelled_future_shift_count", nullable = false) private int cancelledFutureShiftCount;
}
