package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.member.model.RestaurantMember;

@Entity
@Table(name = "schedule_participation",
        indexes = @Index(name = "idx_schedule_participation_member", columnList = "member_id"),
        uniqueConstraints = @UniqueConstraint(name = "uq_schedule_participation_schedule_member",
                columnNames = {"schedule_id", "member_id"}))
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ScheduleParticipation {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private RestaurantMember member;

    /** Immutable business snapshot used to identify the position under which participation began. */
    @Column(name = "position_id", nullable = false)
    private Long positionId;

    @Column(name = "position_name", nullable = false, length = 150)
    private String positionName;
}
