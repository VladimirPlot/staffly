package ru.staffly.schedule.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.BatchSize;
import ru.staffly.member.model.RestaurantMember;

import java.util.LinkedHashSet;
import java.util.Set;

@Entity
@Table(name = "schedule_build_marker", indexes =
        @Index(name = "idx_sbm_position_config", columnList = "position_config_id"))
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class ScheduleBuildMarker {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "position_config_id", nullable = false)
    private ScheduleBuildPositionConfig positionConfig;

    @Column(nullable = false, length = 100)
    private String name;

    @ManyToMany
    @JoinTable(name = "schedule_build_marker_member",
            joinColumns = @JoinColumn(name = "marker_id", nullable = false),
            inverseJoinColumns = @JoinColumn(name = "restaurant_member_id", nullable = false),
            uniqueConstraints = @UniqueConstraint(name = "uq_sbmm_marker_member",
                    columnNames = {"marker_id", "restaurant_member_id"}))
    @BatchSize(size = 64)
    @Builder.Default
    private Set<RestaurantMember> members = new LinkedHashSet<>();
}
