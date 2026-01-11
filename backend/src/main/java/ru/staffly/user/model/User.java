package ru.staffly.user.model;

import jakarta.persistence.*;
import jakarta.validation.constraints.Email;
import lombok.*;
import ru.staffly.common.time.TimeProvider;

import java.time.LocalDate;
import java.time.LocalDateTime;

@Entity
@Table(name = "users",
        uniqueConstraints = {
                @UniqueConstraint(name = "uq_users_phone", columnNames = "phone"),
                @UniqueConstraint(name = "uq_users_email", columnNames = "email")
        })
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class User {
    @Id @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @Column(nullable = false, length = 32, unique = true)
    private String phone;

    // <-- стало NOT NULL
    @Column(nullable = false, length = 255, unique = true)
    @Email
    private String email;

    @Column(name = "first_name", nullable = false, length = 35)
    private String firstName;

    @Column(name = "last_name", nullable = false, length = 35)
    private String lastName;

    @Column(name = "full_name", nullable = false, length = 70)
    private String fullName;

    @Column(name = "avatar_url")
    private String avatarUrl;

    @Column(name = "birth_date")
    private LocalDate birthDate;

    @Column(name = "password_hash", nullable = false, length = 255)
    private String passwordHash;

    @Column(name = "is_active", nullable = false)
    private boolean active = true;

    @Column(name = "created_at", nullable = false, updatable = false)
    private LocalDateTime createdAt = TimeProvider.nowUtc();

    @Column(name = "updated_at", nullable = false)
    private LocalDateTime updatedAt = TimeProvider.nowUtc();

    @PrePersist
    @PreUpdate
    public void updateFullName() {
        this.fullName = (firstName == null ? "" : firstName) + " " + (lastName == null ? "" : lastName);
        if (createdAt == null) createdAt = TimeProvider.nowUtc();
        updatedAt = TimeProvider.nowUtc();
    }
}