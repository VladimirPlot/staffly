package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.training.dto.CurrentUserCertificationExamDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class ExamServiceImplTest {
    @Mock private TrainingExamRepository exams;
    @Mock private TrainingExamSourceFolderRepository sourceFolders;
    @Mock private TrainingExamSourceQuestionRepository sourceQuestions;
    @Mock private TrainingQuestionRepository questions;
    @Mock private TrainingQuestionOptionRepository questionOptions;
    @Mock private TrainingQuestionMatchPairRepository questionPairs;
    @Mock private TrainingQuestionBlankRepository questionBlanks;
    @Mock private TrainingQuestionBlankOptionRepository questionBlankOptions;
    @Mock private TrainingExamAttemptRepository attempts;
    @Mock private TrainingExamAttemptQuestionRepository attemptQuestions;
    @Mock private TrainingExamAssignmentRepository assignments;
    @Mock private TrainingFolderRepository folders;
    @Mock private PositionRepository positions;
    @Mock private TrainingExamAccessService examAccessService;
    @Mock private ExamQuestionPoolResolver questionPoolResolver;
    @Mock private ExamSnapshotService snapshotService;
    @Mock private ExamAttemptEvaluator attemptEvaluator;
    @Mock private CertificationAssignmentSyncService assignmentSyncService;
    @Mock private CertificationAssignmentService certificationAssignmentService;
    @Mock private CertificationAssignmentLifecycleService certificationAssignmentLifecycleService;
    @Mock private CertificationManagerActionService certificationManagerActionService;
    @Mock private CertificationAnalyticsService certificationAnalyticsService;
    @Mock private CertificationSelfResultService certificationSelfResultService;
    @Mock private TrainingPolicyService trainingPolicyService;

    @InjectMocks
    private ExamServiceImpl service;

    @Test
    void startExamResumesExistingCertificationAttemptWithoutCreatingNewOne() {
        var exam = TrainingExam.builder()
                .id(100L)
                .restaurant(ru.staffly.restaurant.model.Restaurant.builder().id(10L).build())
                .mode(TrainingExamMode.CERTIFICATION)
                .title("Cert")
                .description("Desc")
                .questionCount(10)
                .passPercent(80)
                .active(true)
                .version(5)
                .build();
        var assignment = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .examVersionSnapshot(3)
                .build();
        var attempt = TrainingExamAttempt.builder()
                .id(300L)
                .exam(exam)
                .examVersion(3)
                .startedAt(Instant.parse("2026-04-16T10:00:00Z"))
                .build();

        when(exams.findByIdAndRestaurantIdWithVisibility(100L, 10L)).thenReturn(Optional.of(exam));
        when(certificationAssignmentLifecycleService.normalizeForStart(eq(exam), eq(10L), eq(501L), any()))
                .thenReturn(assignment);
        when(certificationAssignmentLifecycleService.findUnfinishedCurrentAttempt(assignment)).thenReturn(Optional.of(attempt));
        when(attemptQuestions.findByAttemptId(300L)).thenReturn(List.of());
        when(sourceFolders.findByExamId(100L)).thenReturn(List.of());
        when(sourceQuestions.findByExamId(100L)).thenReturn(List.of());

        var result = service.startExam(10L, 100L, 501L, false);

        assertEquals(300L, result.attemptId());
        assertEquals(3, result.examVersion());
        verify(attempts, never()).save(any());
        verify(certificationAssignmentService, never()).ensureAttemptsAvailable(any());
    }

    @Test
    void listCurrentUserCertificationExamsReturnsNormalizedAssignmentState() {
        var exam = TrainingExam.builder()
                .id(100L)
                .mode(TrainingExamMode.CERTIFICATION)
                .title("Cert")
                .description("Desc")
                .questionCount(10)
                .passPercent(80)
                .timeLimitSec(1200)
                .attemptLimit(5)
                .active(true)
                .build();
        var assignment = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.IN_PROGRESS)
                .attemptsLimitSnapshot(2)
                .attemptsUsed(1)
                .examVersionSnapshot(4)
                .assignedAt(Instant.parse("2026-04-15T10:00:00Z"))
                .build();

        when(assignments.findActiveCertificationAssignmentsForUser(10L, 501L)).thenReturn(List.of(assignment));
        when(certificationAssignmentLifecycleService.normalize(eq(assignment), any())).thenAnswer(invocation -> {
            assignment.setAttemptsUsed(2);
            assignment.setStatus(TrainingExamAssignmentStatus.EXHAUSTED);
            return assignment;
        });
        when(certificationAssignmentService.calculateAttemptsAllowed(assignment)).thenReturn(2);

        List<CurrentUserCertificationExamDto> result = service.listCurrentUserCertificationExams(10L, 501L);

        assertEquals(1, result.size());
        assertEquals(2, result.get(0).attemptsUsed());
        assertEquals(TrainingExamAssignmentStatus.EXHAUSTED, result.get(0).assignmentStatus());
        assertEquals(2, result.get(0).baseAttemptLimit());
        assertTrue(result.get(0).attemptsAllowed() >= result.get(0).attemptsUsed());
    }

    @Test
    void startExamUsesNormalizedExhaustedStateAndThrowsConflict() {
        var exam = TrainingExam.builder()
                .id(100L)
                .restaurant(ru.staffly.restaurant.model.Restaurant.builder().id(10L).build())
                .mode(TrainingExamMode.CERTIFICATION)
                .title("Cert")
                .description("Desc")
                .questionCount(10)
                .passPercent(80)
                .active(true)
                .version(5)
                .build();
        var assignment = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.IN_PROGRESS)
                .attemptsUsed(1)
                .attemptsLimitSnapshot(2)
                .examVersionSnapshot(3)
                .build();

        when(exams.findByIdAndRestaurantIdWithVisibility(100L, 10L)).thenReturn(Optional.of(exam));
        when(certificationAssignmentLifecycleService.normalizeForStart(eq(exam), eq(10L), eq(501L), any()))
                .thenReturn(assignment);
        when(certificationAssignmentLifecycleService.findUnfinishedCurrentAttempt(assignment)).thenReturn(Optional.empty());
        doThrow(new ru.staffly.common.exception.ConflictException("Лимит попыток по назначенной аттестации исчерпан."))
                .when(certificationAssignmentService).ensureAttemptsAvailable(assignment);

        assertThrows(ru.staffly.common.exception.ConflictException.class, () -> service.startExam(10L, 100L, 501L, false));
        verify(certificationAssignmentService).ensureAttemptsAvailable(assignment);
    }

    @Test
    void getCurrentUserCertificationResultUsesNormalizedAssignment() {
        var exam = TrainingExam.builder()
                .id(100L)
                .restaurant(ru.staffly.restaurant.model.Restaurant.builder().id(10L).build())
                .mode(TrainingExamMode.CERTIFICATION)
                .active(true)
                .build();
        var assignment = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.IN_PROGRESS)
                .attemptsUsed(1)
                .build();
        var normalized = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.EXHAUSTED)
                .attemptsUsed(2)
                .lastAttemptAt(Instant.parse("2026-04-16T10:30:00Z"))
                .build();

        when(exams.findByIdAndRestaurantIdWithVisibility(100L, 10L)).thenReturn(Optional.of(exam));
        when(certificationAssignmentService.findActiveForExamAndUser(100L, 10L, 501L)).thenReturn(Optional.of(assignment));
        when(certificationAssignmentLifecycleService.normalize(eq(assignment), any())).thenReturn(normalized);
        var dto = new ru.staffly.training.dto.CertificationMyResultDto(
                100L, "Cert", "Desc", TrainingExamAssignmentStatus.EXHAUSTED, 40, 80, 2, 2, true, 40,
                Instant.parse("2026-04-16T10:30:00Z"), null, List.of()
        );
        when(certificationSelfResultService.getCurrentUserResult(exam, 10L, 501L, normalized)).thenReturn(dto);

        var result = service.getCurrentUserCertificationResult(10L, 100L, 501L, false);

        assertEquals(2, result.attemptsUsed());
        assertEquals(TrainingExamAssignmentStatus.EXHAUSTED, result.status());
        verify(certificationSelfResultService).getCurrentUserResult(exam, 10L, 501L, normalized);
    }

    @Test
    void passedAssignmentCannotStartNewAttempt() {
        var exam = TrainingExam.builder()
                .id(100L)
                .restaurant(ru.staffly.restaurant.model.Restaurant.builder().id(10L).build())
                .mode(TrainingExamMode.CERTIFICATION)
                .title("Cert")
                .description("Desc")
                .questionCount(10)
                .passPercent(80)
                .active(true)
                .version(5)
                .build();
        var assignment = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.PASSED)
                .passedAt(Instant.parse("2026-04-16T10:00:00Z"))
                .examVersionSnapshot(3)
                .build();

        when(exams.findByIdAndRestaurantIdWithVisibility(100L, 10L)).thenReturn(Optional.of(exam));
        when(certificationAssignmentLifecycleService.normalizeForStart(eq(exam), eq(10L), eq(501L), any()))
                .thenReturn(assignment);
        when(certificationAssignmentLifecycleService.findUnfinishedCurrentAttempt(assignment)).thenReturn(Optional.empty());
        doThrow(new ru.staffly.common.exception.ConflictException("Аттестация уже успешно пройдена. Повторная попытка недоступна."))
                .when(certificationAssignmentService).ensureAttemptsAvailable(assignment);

        assertThrows(ru.staffly.common.exception.ConflictException.class, () -> service.startExam(10L, 100L, 501L, false));
        verify(certificationAssignmentService).ensureAttemptsAvailable(assignment);
        verify(attempts, never()).save(any());
    }
}
