package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;

import java.time.Instant;

@Entity
@Table(name = "training_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "folder_id", nullable = false)
    private TrainingFolder folder;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 20)
    private TrainingQuestionType type;

    @Column(nullable = false, columnDefinition = "text")
    private String prompt;

    @Column(columnDefinition = "text")
    private String explanation;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;

    @Column(name = "is_active", nullable = false)
    @Builder.Default
    private boolean active = true;

    @Column(name = "created_at", nullable = false)
    @Builder.Default
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    @Builder.Default
    private Instant updatedAt = TimeProvider.now();

    @PrePersist
    void prePersist() { if (createdAt == null) createdAt = TimeProvider.now(); if (updatedAt == null) updatedAt = TimeProvider.now(); }
    @PreUpdate
    void preUpdate() { updatedAt = TimeProvider.now(); }
}
