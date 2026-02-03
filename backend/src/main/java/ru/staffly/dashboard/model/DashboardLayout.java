package ru.staffly.dashboard.model;

import com.vladmihalcea.hibernate.type.json.JsonBinaryType;
import org.hibernate.annotations.Type;
import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;

import java.time.Instant;
import java.util.List;

@Entity
@Table(name = "user_dashboard_layout",
        uniqueConstraints = @UniqueConstraint(name = "uq_user_dashboard_layout", columnNames = {"user_id", "restaurant_id"}),
        indexes = @Index(name = "idx_user_dashboard_layout_restaurant", columnList = "restaurant_id"))
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class DashboardLayout {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(name = "restaurant_id", nullable = false)
    private Long restaurantId;

    @Type(JsonBinaryType.class)
    @Column(name = "layout", nullable = false, columnDefinition = "jsonb")
    private List<String> layout;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt;

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt;

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) createdAt = now;
        updatedAt = now;
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}