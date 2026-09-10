package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_change")
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleChange {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "schedule_id", nullable = false)
    private Schedule schedule;

    @Column(name = "actor_user_id", nullable = false)
    private Long actorUserId;

    @Column(name = "actor_display_name", nullable = false)
    private String actorDisplayName;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @OneToMany(mappedBy = "change", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("day ASC, memberId ASC, rowId ASC, id ASC")
    @Builder.Default
    private List<ScheduleChangeItem> items = new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) createdAt = TimeProvider.now();
    }
}
