package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.CreationTimestamp;
import org.hibernate.annotations.UpdateTimestamp;

import java.time.Instant;
import java.time.LocalDate;

@Entity
@Table(name = "schedule_shift_request",
        indexes = {
                @Index(name = "idx_shift_request_schedule", columnList = "schedule_id"),
                @Index(name = "idx_shift_request_from_row", columnList = "from_row_id"),
                @Index(name = "idx_shift_request_to_row", columnList = "to_row_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleShiftRequest {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ScheduleShiftRequestType type;

    @Column(name = "day_from", nullable = false)
    private LocalDate dayFrom;

    @Column(name = "day_to")
    private LocalDate dayTo;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "from_row_id", nullable = false)
    private ScheduleRow fromRow;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "to_row_id", nullable = false)
    private ScheduleRow toRow;

    @Column(name = "initiator_member_id", nullable = false)
    private Long initiatorMemberId;

    @Column(name = "from_member_id", nullable = false)
    private Long fromMemberId;

    @Column(name = "to_member_id", nullable = false)
    private Long toMemberId;

    @Column(columnDefinition = "text")
    private String reason;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 32)
    private ScheduleShiftRequestStatus status;

    @CreationTimestamp
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt;

    @UpdateTimestamp
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;
}