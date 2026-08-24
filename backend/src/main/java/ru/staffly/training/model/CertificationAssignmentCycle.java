package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.user.model.User;

import java.time.Instant;

@Entity
@Table(name = "certification_assignment_cycle",
        uniqueConstraints = @UniqueConstraint(name = "uq_certification_assignment_cycle_exam_sequence",
                columnNames = {"exam_id", "cycle_sequence"}))
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CertificationAssignmentCycle {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private TrainingExam exam;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "assessment_specification_id", nullable = false)
    private CertificationAssessmentSpecification assessmentSpecification;

    @Column(name = "cycle_sequence", nullable = false, updatable = false)
    private int cycleSequence;

    @Enumerated(EnumType.STRING)
    @Column(nullable = false, length = 24, updatable = false)
    private CertificationAssignmentCycleKind kind;

    @Column(name = "launched_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant launchedAt = TimeProvider.now();

    @ManyToOne(fetch = FetchType.LAZY)
    @JoinColumn(name = "launched_by_id")
    private User launchedBy;
}
