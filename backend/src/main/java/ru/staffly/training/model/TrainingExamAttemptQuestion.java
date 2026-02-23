package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "training_exam_attempt_question")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingExamAttemptQuestion {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "attempt_id", nullable = false)
    private TrainingExamAttempt attempt;

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "question_id")
    private TrainingQuestion question;

    @Column(name = "question_snapshot_json", nullable = false, columnDefinition = "text")
    private String questionSnapshotJson;

    @Column(name = "correct_key_json", nullable = false, columnDefinition = "text")
    private String correctKeyJson;

    @Column(name = "chosen_answer_json", columnDefinition = "text")
    private String chosenAnswerJson;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;
}
