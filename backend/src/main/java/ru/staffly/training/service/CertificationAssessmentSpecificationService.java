package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.dto.ExamSourceFolderDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.Comparator;
import java.util.List;
import java.util.Objects;

@Service
@RequiredArgsConstructor
class CertificationAssessmentSpecificationService {
    private final CertificationAssessmentSpecificationRepository specifications;
    private final CertificationAssessmentFolderSourceRepository specificationFolders;
    private final CertificationAssessmentQuestionSourceRepository specificationQuestions;
    private final TrainingExamSourceFolderRepository currentFolders;
    private final TrainingExamSourceQuestionRepository currentQuestions;
    private final CertificationQuestionSnapshotService questionSnapshots;
    private final ExamQuestionPoolResolver poolResolver;

    CertificationAssessmentSpecification createCurrent(TrainingExam exam) {
        return createCurrent(exam, null);
    }

    CertificationAssessmentSpecification createCurrent(TrainingExam exam, CertificationAssessmentSpecification preserved) {
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
                .questionPoolJson(preserved == null ? questionSnapshots.capture(exam) : preserved.getQuestionPoolJson())
                .build());
        if (preserved != null) {
            specification.getFolderSources().addAll(specificationFolders.saveAll(preserved.getFolderSources().stream()
                    .map(source -> CertificationAssessmentFolderSource.builder().specification(specification)
                            .folderId(source.getFolderId()).pickMode(source.getPickMode()).randomCount(source.getRandomCount())
                            .includeDescendants(source.isIncludeDescendants()).build()).toList()));
            specification.getQuestionSources().addAll(specificationQuestions.saveAll(preserved.getQuestionSources().stream()
                    .map(source -> CertificationAssessmentQuestionSource.builder().specification(specification)
                            .questionId(source.getQuestionId()).build()).toList()));
        } else {
            specification.getFolderSources().addAll(specificationFolders.saveAll(currentFolders.findByExamId(exam.getId()).stream()
                    .map(source -> CertificationAssessmentFolderSource.builder()
                            .specification(specification)
                            .folderId(source.getFolder().getId())
                            .pickMode(source.getPickMode())
                            .randomCount(source.getRandomCount())
                            .includeDescendants(source.isIncludeDescendants())
                            .build())
                    .toList()));
            specification.getQuestionSources().addAll(specificationQuestions.saveAll(currentQuestions.findByExamId(exam.getId()).stream()
                    .map(source -> CertificationAssessmentQuestionSource.builder()
                            .specification(specification)
                            .questionId(source.getQuestion().getId())
                            .build())
                    .toList()));
        }
        if (poolResolver.buildQuestionPool(exam.getRestaurant().getId(), specification).questions().size() != specification.getQuestionCount()) {
            throw new BadRequestException("Источники изменились во время публикации. Обновите вопросы и повторите сохранение.");
        }
        return specification;
    }

    CertificationAssessmentSpecification requireCurrent(TrainingExam exam) {
        return specifications.findByExamIdAndVersion(exam.getId(), exam.getVersion())
                .orElseThrow(() -> new IllegalStateException(
                        "Missing certification specification for exam " + exam.getId() + " version " + exam.getVersion()));
    }

    MaterialDiff materialDiff(TrainingExam exam,
                              List<ExamSourceFolderDto> requestedFolders,
                              List<Long> requestedQuestionIds,
                              int questionCount,
                              int passPercent,
                              Integer timeLimitSec,
                              Integer attemptLimit) {
        return materialDiff(exam, requestedFolders, requestedQuestionIds, questionCount, passPercent, timeLimitSec, attemptLimit, true);
    }

    MaterialDiff materialDiff(TrainingExam exam, List<ExamSourceFolderDto> requestedFolders,
                             List<Long> requestedQuestionIds, int questionCount, int passPercent,
                             Integer timeLimitSec, Integer attemptLimit, boolean refreshQuestionBank) {
        var specification = requireCurrent(exam);
        var expectedFolders = specification.getFolderSources().stream()
                .map(source -> new FolderDefinition(source.getFolderId(), source.getPickMode(), source.getRandomCount(), source.isIncludeDescendants()))
                .sorted(Comparator.comparing(FolderDefinition::folderId))
                .toList();
        var actualFolders = (requestedFolders == null ? List.<ExamSourceFolderDto>of() : requestedFolders).stream()
                .map(source -> new FolderDefinition(source.folderId(), source.pickMode(),
                        source.pickMode() == TrainingExamSourcePickMode.RANDOM ? source.randomCount() : null, source.includeDescendants()))
                .distinct()
                .sorted(Comparator.comparing(FolderDefinition::folderId))
                .toList();
        var expectedQuestions = specification.getQuestionSources().stream()
                .map(CertificationAssessmentQuestionSource::getQuestionId).distinct().sorted().toList();
        var actualQuestions = (requestedQuestionIds == null ? List.<Long>of() : requestedQuestionIds).stream()
                .filter(Objects::nonNull).distinct().sorted().toList();
        var changedFields = new java.util.ArrayList<String>();
        if (!expectedFolders.equals(actualFolders)) changedFields.add("sourcesFolders");
        if (!expectedQuestions.equals(actualQuestions)) changedFields.add("sourceQuestionIds");
        if (refreshQuestionBank && expectedFolders.equals(actualFolders) && expectedQuestions.equals(actualQuestions)
                && !questionSnapshots.sameContent(specification.getQuestionPoolJson(), questionSnapshots.capture(exam))) {
            changedFields.add("questionContent");
        }
        if (questionCount != specification.getQuestionCount()) changedFields.add("questionCount");
        if (passPercent != specification.getPassPercent()) changedFields.add("passPercent");
        if (!Objects.equals(timeLimitSec, specification.getTimeLimitSec())) changedFields.add("timeLimitSec");
        if (!Objects.equals(attemptLimit, specification.getAttemptLimit())) changedFields.add("attemptLimit");
        return new MaterialDiff(!changedFields.isEmpty(), List.copyOf(changedFields));
    }

    record MaterialDiff(boolean materialChanged, List<String> changedFields) {}
    private record FolderDefinition(Long folderId, TrainingExamSourcePickMode pickMode, Integer randomCount, boolean includeDescendants) {}
}
