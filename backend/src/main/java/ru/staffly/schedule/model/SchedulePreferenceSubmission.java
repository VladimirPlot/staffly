package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.member.model.RestaurantMember;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_preference_submission",
        indexes = {
                @Index(name = "idx_schedule_pref_submission_schedule", columnList = "schedule_id"),
                @Index(name = "idx_schedule_pref_submission_member", columnList = "member_id"),
                @Index(name = "idx_schedule_pref_submission_schedule_member", columnList = "schedule_id, member_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_schedule_pref_submission_schedule_member", columnNames = {"schedule_id", "member_id"})
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class SchedulePreferenceSubmission {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "member_id", nullable = false)
    private RestaurantMember member;

    @Column(name = "user_id")
    private Long userId;

    @Column(name = "position_id")
    private Long positionId;

    @Column(name = "position_name", length = 150)
    private String positionName;

    @Column(name = "submitted_at", nullable = false)
    private Instant submittedAt;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @Column(name = "revision", nullable = false)
    @Builder.Default
    private int revision = 1;

    @Column(name = "period_comment", columnDefinition = "text")
    private String periodComment;

    @OneToMany(mappedBy = "submission", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("day ASC, sortOrder ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<SchedulePreferenceCell> cells = new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
        if (submittedAt == null) submittedAt = now;
        if (revision < 1) revision = 1;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
