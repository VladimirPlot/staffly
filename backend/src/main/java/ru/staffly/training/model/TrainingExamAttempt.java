package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "training_exam_attempt")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingExamAttempt {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private TrainingExam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "score_percent")
    private Integer scorePercent;

    @Column(name = "passed")
    private Boolean passed;
}
