package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;
import ru.staffly.training.repository.TrainingExamRepository;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
class CertificationAnalyticsService {
    private final TrainingExamRepository exams;
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingExamAttemptRepository attempts;
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final RestaurantMemberRepository members;
    private final CertificationAssignmentService assignmentService;
    private final ExamSnapshotService snapshotService;

    @Transactional(readOnly = true)
    public CertificationExamSummaryDto getExamSummary(Long restaurantId, Long examId) {
        var rows = loadActiveAssignmentScope(restaurantId, examId);
        return toSummary(rows);
    }

    @Transactional(readOnly = true)
    public List<CertificationExamPositionBreakdownDto> getPositionBreakdown(Long restaurantId, Long examId) {
        var rows = loadActiveAssignmentScope(restaurantId, examId);
        return rows.stream()
                .collect(Collectors.groupingBy(a -> new PositionKey(
                        a.getAssignedPosition() == null ? null : a.getAssignedPosition().getId(),
                        a.getAssignedPosition() == null ? "—" : a.getAssignedPosition().getName())))
                .entrySet().stream()
                .map(entry -> {
                    var summary = toSummary(entry.getValue());
                    return new CertificationExamPositionBreakdownDto(
                            entry.getKey().positionId(),
                            entry.getKey().positionName(),
                            summary.totalAssigned(),
                            summary.passedCount(),
                            summary.failedCount(),
                            summary.inProgressCount(),
                            summary.notStartedCount(),
                            summary.averageScore(),
                            summary.passRate()
                    );
                })
                .sorted(Comparator
                        .comparing(CertificationExamPositionBreakdownDto::positionName, Comparator.nullsLast(String::compareToIgnoreCase))
                        .thenComparing(CertificationExamPositionBreakdownDto::positionId, Comparator.nullsLast(Long::compareTo)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CertificationExamEmployeeRowDto> getEmployeeRows(Long restaurantId, Long examId) {
        var rows = loadActiveAssignmentScope(restaurantId, examId);
        var userIds = rows.stream().map(a -> a.getUser().getId()).collect(Collectors.toSet());
        var memberByUserId = members.findWithUserAndPositionByRestaurantId(restaurantId).stream()
                .filter(member -> userIds.contains(member.getUser().getId()))
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity(), (a, b) -> a));

        return rows.stream()
                .map(assignment -> {
                    var member = memberByUserId.get(assignment.getUser().getId());
                    return new CertificationExamEmployeeRowDto(
                            assignment.getId(),
                            assignment.getUser().getId(),
                            assignment.getUser().getFullName(),
                            assignment.getAssignedPosition() == null ? null : assignment.getAssignedPosition().getId(),
                            assignment.getAssignedPosition() == null ? null : assignment.getAssignedPosition().getName(),
                            member == null || member.getPosition() == null ? null : member.getPosition().getId(),
                            member == null || member.getPosition() == null ? null : member.getPosition().getName(),
                            assignment.getStatus(),
                            CertificationAnalyticsStatusMapper.fromLifecycle(assignment.getStatus()),
                            assignment.getAttemptsUsed(),
                            assignmentService.calculateAttemptsAllowed(assignment),
                            assignment.getExtraAttempts(),
                            assignment.getBestScore(),
                            assignment.getLastAttemptAt(),
                            assignment.getPassedAt()
                    );
                })
                .sorted(Comparator.comparing(CertificationExamEmployeeRowDto::fullName, Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CertificationExamAttemptHistoryDto> getEmployeeAttemptHistory(Long restaurantId, Long examId, Long userId) {
        ensureCertificationExam(restaurantId, examId);
        // История для employee endpoint возвращается как полная история попыток пользователя по exam.
        // Assignment-поля добавлены для прозрачного понимания связи попыток с циклом назначений.
        return attempts.findByExamIdAndRestaurantIdAndUserIdOrderByStartedAtDesc(examId, restaurantId, userId).stream()
                .map(attempt -> new CertificationExamAttemptHistoryDto(
                        attempt.getId(),
                        attempt.getAssignment() == null ? null : attempt.getAssignment().getId(),
                        attempt.getAssignment() == null ? null : attempt.getAssignment().getExamVersionSnapshot(),
                        attempt.getStartedAt(),
                        attempt.getFinishedAt(),
                        attempt.getScorePercent(),
                        attempt.getPassed(),
                        attempt.getExamVersion()
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public CertificationAttemptDetailsDto getAttemptDetails(Long restaurantId, Long examId, Long attemptId) {
        ensureCertificationExam(restaurantId, examId);
        var attempt = attempts.findByIdAndRestaurantId(attemptId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Attempt not found"));
        if (attempt.getExam() == null || !Objects.equals(attempt.getExam().getId(), examId)) {
            throw new NotFoundException("Attempt not found for this exam");
        }

        var questions = attemptQuestions.findByAttemptId(attemptId).stream()
                .map(item -> {
                    var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
                    return new CertificationAttemptDetailsQuestionDto(
                            snapshot.questionId(),
                            snapshot.type(),
                            snapshot.prompt(),
                            item.getChosenAnswerJson(),
                            item.isCorrect(),
                            item.getCorrectKeyJson(),
                            snapshot.explanation()
                    );
                })
                .toList();

        var startedAt = attempt.getStartedAt();
        var finishedAt = attempt.getFinishedAt();
        Long durationSec = startedAt != null && finishedAt != null
                ? Math.max(0L, finishedAt.getEpochSecond() - startedAt.getEpochSecond())
                : null;

        return new CertificationAttemptDetailsDto(
                attempt.getId(),
                attempt.getExam() == null ? null : attempt.getExam().getId(),
                attempt.getTitleSnapshot(),
                attempt.getExam() == null ? null : attempt.getExam().getDescription(),
                attempt.getUser().getId(),
                attempt.getUser().getFullName(),
                attempt.getAssignment() == null ? null : attempt.getAssignment().getId(),
                attempt.getExamVersion(),
                startedAt,
                finishedAt,
                attempt.getScorePercent(),
                attempt.getPassPercentSnapshot(),
                Boolean.TRUE.equals(attempt.getPassed()),
                attempt.getQuestionCountSnapshot(),
                durationSec,
                questions
        );
    }

    private List<TrainingExamAssignment> loadActiveAssignmentScope(Long restaurantId, Long examId) {
        ensureCertificationExam(restaurantId, examId);
        return assignments.findActiveByExamIdAndRestaurantId(examId, restaurantId);
    }

    private CertificationExamSummaryDto toSummary(List<TrainingExamAssignment> rows) {
        int total = rows.size();
        int passed = countAnalyticsStatus(rows, CertificationAnalyticsStatus.PASSED);
        int failed = countAnalyticsStatus(rows, CertificationAnalyticsStatus.FAILED);
        int inProgress = countAnalyticsStatus(rows, CertificationAnalyticsStatus.IN_PROGRESS);
        int notStarted = countAnalyticsStatus(rows, CertificationAnalyticsStatus.NOT_STARTED);

        var scored = rows.stream().map(TrainingExamAssignment::getBestScore).filter(Objects::nonNull).toList();
        Double avg = scored.isEmpty() ? null : scored.stream().mapToInt(Integer::intValue).average().orElse(0d);
        Double passRate = total == 0 ? 0d : (passed * 100.0) / total;

        return new CertificationExamSummaryDto(total, passed, failed, inProgress, notStarted, avg, passRate);
    }

    private int countAnalyticsStatus(List<TrainingExamAssignment> rows, CertificationAnalyticsStatus status) {
        return (int) rows.stream()
                .map(TrainingExamAssignment::getStatus)
                .map(CertificationAnalyticsStatusMapper::fromLifecycle)
                .filter(item -> item == status)
                .count();
    }

    private void ensureCertificationExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Analytics is available only for certification exams.");
        }
    }

    private record PositionKey(Long positionId, String positionName) {
    }
}
