package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Table(name = "schedule_build_template",
        indexes = @Index(name = "idx_sbt_restaurant", columnList = "restaurant_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildTemplate {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(name = "name", nullable = false, length = 150)
    private String name;

    @Column(name = "description", columnDefinition = "text")
    private String description;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean isActive = true;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @OneToMany(mappedBy = "template", cascade = CascadeType.ALL, orphanRemoval = true)
    @OrderBy("sortOrder ASC, id ASC")
    @BatchSize(size = 64)
    @Builder.Default
    private List<ScheduleBuildPositionConfig> positionConfigs = new ArrayList<>();

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) createdAt = now;
        if (updatedAt == null) updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}
