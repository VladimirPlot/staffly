package ru.staffly.dictionary.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.restaurant.model.Restaurant;

import java.time.LocalTime;

@Entity
@Table(name = "shift",
        indexes = {
                @Index(name = "idx_shift_restaurant", columnList = "restaurant_id")
        })
@Getter @Setter @NoArgsConstructor @AllArgsConstructor @Builder
public class Shift {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @Column(nullable = false, length = 100)
    private String name;

    @Column(name = "start_time", nullable = false)
    private LocalTime startTime;

    @Column(name = "end_time", nullable = false)
    private LocalTime endTime;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;
}