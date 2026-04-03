package ru.staffly.dictionary.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.master_schedule.model.PayType;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.HashSet;
import java.util.Set;

@Entity
@Table(name = "position",
        indexes = {
                @Index(name = "idx_position_restaurant", columnList = "restaurant_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Position {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Enumerated(EnumType.STRING)
    @Column(name = "level", nullable = false, length = 20)
    @Builder.Default
    private RestaurantRole level = RestaurantRole.STAFF;

    @ElementCollection(fetch = FetchType.EAGER)
    @CollectionTable(name = "position_specialization", joinColumns = @JoinColumn(name = "position_id"))
    @Column(name = "specialization", nullable = false, length = 40)
    @Enumerated(EnumType.STRING)
    @Builder.Default
    private Set<PositionSpecialization> specializations = new HashSet<>();

    @Enumerated(EnumType.STRING)
    @Column(name = "pay_type", nullable = false, length = 20)
    @Builder.Default
    private PayType payType = PayType.HOURLY;

    @Column(name = "pay_rate", precision = 12, scale = 2)
    private java.math.BigDecimal payRate;

    @Column(name = "norm_hours")
    private Integer normHours;
}
