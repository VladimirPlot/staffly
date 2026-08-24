package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;
import ru.staffly.common.time.TimeProvider;

import java.time.Instant;
import java.util.ArrayList;
import java.util.List;

@Entity
@Immutable
@Table(name = "certification_assessment_specification",
        uniqueConstraints = @UniqueConstraint(name = "uq_certification_specification_exam_version",
                columnNames = {"exam_id", "version"}))
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CertificationAssessmentSpecification {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "exam_id", nullable = false)
    private TrainingExam exam;

    @Column(nullable = false)
    private int version;

    @Column(name = "question_count", nullable = false)
    private int questionCount;

    @Column(name = "pass_percent", nullable = false)
    private int passPercent;

    @Column(name = "time_limit_sec")
    private Integer timeLimitSec;

    @Column(name = "attempt_limit")
    private Integer attemptLimit;

    @Column(name = "created_at", nullable = false, updatable = false)
    @Builder.Default
    private Instant createdAt = TimeProvider.now();

    @OneToMany(mappedBy = "specification", fetch = FetchType.LAZY)
    @Builder.Default
    private List<CertificationAssessmentFolderSource> folderSources = new ArrayList<>();

    @OneToMany(mappedBy = "specification", fetch = FetchType.LAZY)
    @Builder.Default
    private List<CertificationAssessmentQuestionSource> questionSources = new ArrayList<>();
}
