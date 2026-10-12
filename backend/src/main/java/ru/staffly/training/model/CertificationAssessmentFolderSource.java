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

    /** Historical identity, retained even after the live source folder is deleted. */
    @Column(name = "folder_id", nullable = false, updatable = false)
    private Long folderId;

    @Enumerated(EnumType.STRING)
    @Column(name = "pick_mode", nullable = false, length = 20)
    private TrainingExamSourcePickMode pickMode;

    @Column(name = "random_count")
    private Integer randomCount;

    @Column(name = "include_descendants", nullable = false, updatable = false)
    private boolean includeDescendants;
}
