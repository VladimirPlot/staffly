package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.training.dto.ExamSourceFolderDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
class CertificationAssessmentSpecificationService {
    static final String MATERIAL_CHANGE_ERROR =
            "Изменение вопросов или правил аттестации требует нового цикла.";

    private final CertificationAssessmentSpecificationRepository specifications;
    private final CertificationAssessmentFolderSourceRepository specificationFolders;
    private final CertificationAssessmentQuestionSourceRepository specificationQuestions;
    private final TrainingExamSourceFolderRepository currentFolders;
    private final TrainingExamSourceQuestionRepository currentQuestions;

    CertificationAssessmentSpecification createCurrent(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new IllegalArgumentException("Assessment specifications belong to Certification exams only");
        }
        if (specifications.findByExamIdAndVersion(exam.getId(), exam.getVersion()).isPresent()) {
            throw new ConflictException("Specification already exists for certification version");
        }
        var specification = specifications.saveAndFlush(CertificationAssessmentSpecification.builder()
                .exam(exam)
                .version(exam.getVersion())
                .questionCount(exam.getQuestionCount())
                .passPercent(exam.getPassPercent())
                .timeLimitSec(exam.getTimeLimitSec())
                .attemptLimit(exam.getAttemptLimit())
                .build());
        specificationFolders.saveAll(currentFolders.findByExamId(exam.getId()).stream()
                .map(source -> CertificationAssessmentFolderSource.builder()
                        .specification(specification)
                        .folder(source.getFolder())
                        .pickMode(source.getPickMode())
                        .randomCount(source.getRandomCount())
                        .build())
                .toList());
        specificationQuestions.saveAll(currentQuestions.findByExamId(exam.getId()).stream()
                .map(source -> CertificationAssessmentQuestionSource.builder()
                        .specification(specification)
                        .question(source.getQuestion())
                        .build())
                .toList());
        return specification;
    }

    CertificationAssessmentSpecification requireCurrent(TrainingExam exam) {
        return specifications.findByExamIdAndVersion(exam.getId(), exam.getVersion())
                .orElseThrow(() -> new IllegalStateException(
                        "Missing certification specification for exam " + exam.getId() + " version " + exam.getVersion()));
    }

    void assertMaterialUnchanged(TrainingExam exam,
                                 List<ExamSourceFolderDto> requestedFolders,
                                 List<Long> requestedQuestionIds,
                                 int questionCount,
                                 int passPercent,
                                 Integer timeLimitSec,
                                 Integer attemptLimit) {
        var specification = requireCurrent(exam);
        var expectedFolders = specification.getFolderSources().stream()
                .map(source -> new FolderDefinition(source.getFolder().getId(), source.getPickMode(), source.getRandomCount()))
                .sorted(Comparator.comparing(FolderDefinition::folderId))
                .toList();
        var actualFolders = (requestedFolders == null ? List.<ExamSourceFolderDto>of() : requestedFolders).stream()
                .map(source -> new FolderDefinition(source.folderId(), source.pickMode(),
                        source.pickMode() == TrainingExamSourcePickMode.RANDOM ? source.randomCount() : null))
                .distinct()
                .sorted(Comparator.comparing(FolderDefinition::folderId))
                .toList();
        var expectedQuestions = specification.getQuestionSources().stream()
                .map(source -> source.getQuestion().getId()).distinct().sorted().toList();
        var actualQuestions = (requestedQuestionIds == null ? List.<Long>of() : requestedQuestionIds).stream()
                .filter(Objects::nonNull).distinct().sorted().toList();
        if (questionCount != specification.getQuestionCount()
                || passPercent != specification.getPassPercent()
                || !Objects.equals(timeLimitSec, specification.getTimeLimitSec())
                || !Objects.equals(attemptLimit, specification.getAttemptLimit())
                || !expectedFolders.equals(actualFolders)
                || !expectedQuestions.equals(actualQuestions)) {
            throw new ConflictException(MATERIAL_CHANGE_ERROR);
        }
    }

    private record FolderDefinition(Long folderId, TrainingExamSourcePickMode pickMode, Integer randomCount) {}
}
