package ru.staffly.training.model;

import jakarta.persistence.*;
import lombok.*;
import org.hibernate.annotations.Immutable;

@Entity
@Immutable
@Table(name = "certification_assessment_folder_source")
@Getter
@NoArgsConstructor
@AllArgsConstructor
@Builder
public class CertificationAssessmentFolderSource {
    @Id
    @GeneratedValue(strategy = GenerationType.IDENTITY)
    private Long id;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "specification_id", nullable = false)
    private CertificationAssessmentSpecification specification;

    @ManyToOne(fetch = FetchType.LAZY, optional = false)
    @JoinColumn(name = "folder_id", nullable = false)
    private TrainingFolder folder;

    @Enumerated(EnumType.STRING)
    @Column(name = "pick_mode", nullable = false, length = 20)
    private TrainingExamSourcePickMode pickMode;

    @Column(name = "random_count")
    private Integer randomCount;
}
