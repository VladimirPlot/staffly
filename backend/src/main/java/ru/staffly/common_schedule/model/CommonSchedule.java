package ru.staffly.common_schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.Schedule;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "common_schedule")
@Getter @Setter @NoArgsConstructor
public class CommonSchedule {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;
    @Version @Column(nullable = false)
    private Long version;
    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;
    @Column(nullable = false, length = 255)
    private String title;
    @Column(name = "visible_to_positions", nullable = false)
    private boolean visibleToPositions;
    @ManyToMany
    @JoinTable(name = "common_schedule_source",
            joinColumns = @JoinColumn(name = "common_schedule_id"),
            inverseJoinColumns = @JoinColumn(name = "schedule_id"))
    @OrderColumn(name = "source_order")
    @BatchSize(size = 32)
    private List<Schedule> sources = new ArrayList<>();
    @Column(name = "created_at", nullable = false, updatable = false)
    private Instant createdAt = TimeProvider.now();
    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = TimeProvider.now();

    @PreUpdate
    void preUpdate() { updatedAt = TimeProvider.now(); }

    public Schedule primary() { return sources.get(0); }
}
