package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule",
        indexes = {
                @Index(name = "idx_schedule_restaurant", columnList = "restaurant_id")
        },
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_schedule_restaurant_title", columnNames = {"restaurant_id", "title"})
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class Schedule {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 255)
    private String title;

    @Column(name = "start_date", nullable = false)
    private LocalDate startDate;

    @Column(name = "end_date", nullable = false)
    private LocalDate endDate;

    @Enumerated(EnumType.STRING)
    @Column(name = "shift_mode", nullable = false, length = 32)
    private ScheduleShiftMode shiftMode;

    @Column(name = "show_full_name", nullable = false)
    private boolean showFullName;

    @Column(name = "position_ids", columnDefinition = "text")
    @Convert(converter = PositionIdsConverter.class)
    @Builder.Default
    private List<Long> positionIds = new ArrayList<>();

    @OneToMany(mappedBy = "schedule", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleRow> rows = new ArrayList<>();

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = Instant.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = Instant.now();

    @PrePersist
    void prePersist() {
        Instant now = Instant.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = Instant.now();
    }
}