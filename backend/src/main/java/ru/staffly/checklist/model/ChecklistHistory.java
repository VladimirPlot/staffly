package ru.staffly.checklist.model;

import jakarta.persistence.*;
import lombok.AllArgsConstructor;
import lombok.Builder;
import lombok.Getter;
import lombok.NoArgsConstructor;
import lombok.Setter;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.time.LocalTime;
import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "checklist_history",
        indexes = {
                @Index(name = "idx_checklist_history_restaurant_reset", columnList = "restaurant_id, reset_at"),
                @Index(name = "idx_checklist_history_checklist_reset", columnList = "checklist_id, reset_at")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class ChecklistHistory {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "checklist_id")
    private Checklist checklist;

    @Column(name = "checklist_name", nullable = false, length = 200)
    private String checklistName;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false, length = 20)
    private ChecklistKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "periodicity", length = 20)
    private ChecklistPeriodicity periodicity;

    @Column(name = "reset_time")
    private LocalTime resetTime;

    @Column(name = "reset_day_of_week")
    private Integer resetDayOfWeek;

    @Column(name = "reset_day_of_month")
    private Integer resetDayOfMonth;

    @Column(name = "started_at")
    private Instant startedAt;

    @Column(name = "reset_at", nullable = false)
    private Instant resetAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "reset_reason", nullable = false, length = 20)
    private ChecklistResetReason resetReason;

    @Column(name = "completed", nullable = false)
    private boolean completed;

    @Column(name = "total_items", nullable = false)
    private int totalItems;

    @Column(name = "completed_items", nullable = false)
    private int completedItems;

    @Column(name = "positions_snapshot", columnDefinition = "TEXT")
    private String positionsSnapshot;

    @Builder.Default
    @OneToMany(mappedBy = "history", cascade = CascadeType.ALL, orphanRemoval = true)
    private Set<ChecklistItemHistory> items = new HashSet<>();
}
