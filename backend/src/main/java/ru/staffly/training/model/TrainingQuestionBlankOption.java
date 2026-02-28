package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "training_question_blank_option")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingQuestionBlankOption {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "blank_id", nullable = false)
    private TrainingQuestionBlank blank;

    @Column(nullable = false, columnDefinition = "text")
    private String text;

    @Column(name = "is_correct", nullable = false)
    private boolean correct;

    @Column(name = "sort_order", nullable = false)
    @Builder.Default
    private int sortOrder = 0;
}