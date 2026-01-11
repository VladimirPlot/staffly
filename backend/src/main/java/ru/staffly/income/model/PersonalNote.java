package ru.staffly.income.model;

import jakarta.persistence.*;
import lombok.*;

import ru.staffly.common.time.TimeProvider;

import java.time.Instant;

@Entity
@Table(name = "personal_notes",
        indexes = {
                @Index(name = "idx_personal_notes_user", columnList = "user_id")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class PersonalNote {

    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(name = "user_id", nullable = false)
    private Long userId;

    @Column(length = 255)
    private String title;

    @Column(columnDefinition = "text")
    private String content;

    @Column(name = "created_at", nullable = false)
    private Instant createdAt = TimeProvider.now();

    @Column(name = "updated_at", nullable = false)
    private Instant updatedAt = TimeProvider.now();

    @PrePersist
    void prePersist() {
        Instant now = TimeProvider.now();
        if (createdAt == null) {
            createdAt = now;
        }
        if (updatedAt == null) {
            updatedAt = now;
        }
    }

    @PreUpdate
    void preUpdate() {
        updatedAt = TimeProvider.now();
    }
}