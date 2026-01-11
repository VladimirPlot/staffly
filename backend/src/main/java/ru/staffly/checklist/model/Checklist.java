package ru.staffly.checklist.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Set;

@Entity
@Table(name = "checklist",
        indexes = {
                @Index(name = "idx_checklist_restaurant", columnList = "restaurant_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Checklist {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 200)
    private String name;

    @Column(name = "content", columnDefinition = "TEXT")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Enumerated(EnumType.STRING)
    @Column(name = "kind", nullable = false)
    private ChecklistKind kind;

    @Enumerated(EnumType.STRING)
    @Column(name = "periodicity")
    private ChecklistPeriodicity periodicity;

    @Column(name = "reset_time")
    private LocalTime resetTime;

    @Column(name = "reset_day_of_week")
    private Integer resetDayOfWeek;

    @Column(name = "reset_day_of_month")
    private Integer resetDayOfMonth;

    @Column(name = "last_reset_at")
    private Instant lastResetAt;

    @Column(name = "completed", nullable = false)
    private boolean completed;

    @Builder.Default
    @ManyToMany
    @JoinTable(name = "checklist_position",
            joinColumns = @JoinColumn(name = "checklist_id"),
            inverseJoinColumns = @JoinColumn(name = "position_id"))
    private Set<Position> positions = new HashSet<>();

    @Builder.Default
    @OneToMany(mappedBy = "checklist", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("itemOrder ASC")
    private List<ChecklistItem> items = new ArrayList<>();

    @PrePersist
    void prePersist() {
        if (createdAt == null) {
            createdAt = TimeProvider.now();
        }
        if (kind == null) {
            kind = ChecklistKind.INFO;
        }
    }
}