package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;

@Entity
@Table(name = "training_exam_source_folder")
@Getter
@Setter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class TrainingExamSourceFolder {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private TrainingExam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "folder_id", nullable = false)
    private TrainingFolder folder;

    @Enumerated(EnumType.STRING)
    @Column(name = "pick_mode", nullable = false, length = 20)
    private TrainingExamSourcePickMode pickMode;

    @Column(name = "random_count")
    private Integer randomCount;
}

