package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptQuestionRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class CertificationSelfResultServiceTest {
    @Mock
    private TrainingExamAssignmentRepository assignments;
    @Mock
    private TrainingExamAttemptRepository attempts;
    @Mock
    private TrainingExamAttemptQuestionRepository attemptQuestions;
    @Mock
    private CertificationAssignmentService certificationAssignmentService;
    @Mock
    private ExamSnapshotService snapshotService;

    @InjectMocks
    private CertificationSelfResultService service;

    @Test
    void getCurrentUserResultUsesOnlyCurrentAssignmentContext() {
        var exam = TrainingExam.builder()
                .id(100L)
                .title("Cert")
                .description("Desc")
                .mode(TrainingExamMode.CERTIFICATION)
                .passPercent(80)
                .build();
        var activeAssignment = TrainingExamAssignment.builder()
                .id(200L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.FAILED)
                .examVersionSnapshot(6)
                .attemptsUsed(1)
                .bestScore(40)
                .lastAttemptAt(Instant.parse("2026-04-17T10:00:00Z"))
                .build();
        var finishedAttempt = TrainingExamAttempt.builder()
                .id(300L)
                .assignment(activeAssignment)
                .finishedAt(Instant.parse("2026-04-17T10:00:00Z"))
                .scorePercent(40)
                .passed(false)
                .build();

        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(200L, 6))
                .thenReturn(List.of(finishedAttempt));
        when(attemptQuestions.findByAttemptId(300L)).thenReturn(List.of());
        when(certificationAssignmentService.calculateAttemptsAllowed(activeAssignment)).thenReturn(1);

        var result = service.getCurrentUserResult(exam, 10L, 501L, activeAssignment);

        assertEquals(TrainingExamAssignmentStatus.FAILED, result.assignmentStatus());
        assertEquals(40, result.scorePercent());
        assertEquals(1, result.attemptsUsed());
        verify(attempts, never()).findByExamIdAndRestaurantIdAndUserIdOrderByStartedAtDesc(anyLong(), anyLong(), anyLong());
    }

    @Test
    void getCurrentUserResultFallsBackToLatestAssignmentWhenActiveMissing() {
        var exam = TrainingExam.builder()
                .id(100L)
                .title("Cert")
                .description("Desc")
                .mode(TrainingExamMode.CERTIFICATION)
                .passPercent(80)
                .build();
        var archivedAssignment = TrainingExamAssignment.builder()
                .id(201L)
                .exam(exam)
                .status(TrainingExamAssignmentStatus.ARCHIVED)
                .examVersionSnapshot(5)
                .attemptsUsed(2)
                .bestScore(100)
                .passedAt(Instant.parse("2026-04-10T10:00:00Z"))
                .build();

        when(assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(100L, 10L, 501L)).thenReturn(Optional.empty());
        when(assignments.findTopByExamIdAndRestaurantIdAndUserIdOrderByActiveDescAssignedAtDescIdDesc(100L, 10L, 501L))
                .thenReturn(Optional.of(archivedAssignment));
        when(attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(201L, 5))
                .thenReturn(List.of());
        when(certificationAssignmentService.calculateAttemptsAllowed(archivedAssignment)).thenReturn(2);

        var result = service.getCurrentUserResult(exam, 10L, 501L, null);

        assertEquals(TrainingExamAssignmentStatus.ARCHIVED, result.assignmentStatus());
        assertNull(result.scorePercent());
        assertEquals(100, result.bestScore());
        assertEquals(2, result.attemptsUsed());
    }
}