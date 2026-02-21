package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "training_question_match_pair")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingQuestionMatchPair {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "question_id", nullable = false)
    private TrainingQuestion question;

    @Column(name = "left_text", nullable = false, columnDefinition = "text")
    private String leftText;

    @Column(name = "right_text", nullable = false, columnDefinition = "text")
    private String rightText;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;
}
