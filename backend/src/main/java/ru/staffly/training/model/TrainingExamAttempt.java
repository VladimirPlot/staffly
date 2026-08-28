package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.restaurant.model.Restaurant;
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

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "exam_id")
    private TrainingExam exam;

    @Column(name = "exam_version", nullable = false)
    private int examVersion;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "restaurant_id", nullable = false)
    private Restaurant restaurant;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "assignment_id")
    private TrainingExamAssignment assignment;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "user_id", nullable = false)
    private User user;

    @Column(name = "started_at", nullable = false)
    private Instant startedAt;

    @Column(name = "finished_at")
    private Instant finishedAt;

    @Column(name = "pass_percent_snapshot", nullable = false)
    private int passPercentSnapshot;

    @Column(name = "title_snapshot", nullable = false, length = 150)
    private String titleSnapshot;

    @Column(name = "question_count_snapshot", nullable = false)
    private int questionCountSnapshot;

    @Column(name = "time_limit_sec_snapshot")
    private Integer timeLimitSecSnapshot;

    /** Nullable for attempts created before position-at-start tracking was introduced. */
    @Column(name = "position_at_start_id")
    private Long positionAtStartId;

    @Column(name = "position_at_start_captured", nullable = false)
    private boolean positionAtStartCaptured;

    @Enumerated(EnumType.STRING)
    @Column(name = "cancellation_reason", length = 40)
    private TrainingExamAttemptCancellationReason cancellationReason;

    @Column(name = "score_percent")
    private Integer scorePercent;

    @Column(name = "passed")
    private Boolean passed;
}
