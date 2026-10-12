package ru.staffly.training.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;

import java.time.Clock;
import java.time.Instant;
import java.time.ZoneOffset;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TrainingAttemptRuntimeTest {
    final ObjectMapper mapper = new ObjectMapper();
    final TrainingExamAttemptRepository attempts = mock(TrainingExamAttemptRepository.class);
    final TrainingExamAttemptQuestionRepository questions = mock(TrainingExamAttemptQuestionRepository.class);
    final TrainingExamAssignmentRepository assignments = mock(TrainingExamAssignmentRepository.class);
    final EntityManager entityManager = mock(EntityManager.class);
    final CertificationAssignmentService assignmentService = mock(CertificationAssignmentService.class);
    final CertificationAttemptFinalizationService finalizer = new CertificationAttemptFinalizationService(
            questions, attempts, assignments, entityManager, new ExamSnapshotService(mapper),
            new ExamAttemptEvaluator(mapper), assignmentService, mock(RestaurantMemberRepository.class));
    final Instant started = Instant.parse("2026-10-11T12:00:00Z");
    final TrainingExam exam = TrainingExam.builder().id(10L).mode(TrainingExamMode.CERTIFICATION).build();
    final TrainingExamAssignment assignment = TrainingExamAssignment.builder().id(20L).examVersionSnapshot(1).build();
    final TrainingExamAttempt attempt = TrainingExamAttempt.builder().id(30L).restaurant(Restaurant.builder().id(1L).build())
            .exam(exam).assignment(assignment).user(User.builder().id(7L).build()).examVersion(1)
            .startedAt(started).timeLimitSecSnapshot(60).passPercentSnapshot(70).build();
    final List<TrainingExamAttemptQuestion> items = new ArrayList<>();
    Clock originalClock;

    @BeforeEach void setup() throws Exception {
        originalClock = TimeProvider.clock();
        TimeProvider.setClock(Clock.fixed(started.plusSeconds(10), ZoneOffset.UTC));
        when(assignments.findByIdAndRestaurantIdForFinalizationUpdate(20L, 1L)).thenReturn(Optional.of(assignment));
        when(attempts.findByIdAndRestaurantIdForFinalizationUpdate(30L, 1L)).thenReturn(Optional.of(attempt));
        when(questions.findByAttemptId(30L)).thenReturn(items);
        for (long id = 1; id <= 10; id++) {
            var snapshot = new AttemptQuestionSnapshotDto(id, TrainingQuestionType.SINGLE, "Question", null,
                    List.of(new TrainingQuestionOptionViewDto(0, "yes"), new TrainingQuestionOptionViewDto(1, "no")),
                    List.of(), List.of());
            items.add(TrainingExamAttemptQuestion.builder().attempt(attempt)
                    .questionSnapshotJson(mapper.writeValueAsString(snapshot)).correctKeyJson("\"yes\"").build());
        }
    }

    @AfterEach void restoreClock() { TimeProvider.setClock(originalClock); }

    void save(long questionId, String value) {
        finalizer.saveAnswer(attempt, new SubmitAttemptAnswerDto(questionId, "\"" + value + "\""));
    }

    @Test void eightConfirmedCorrectAnswersPassAtTimeoutAndUnansweredQuestionsFail() {
        for (long id = 1; id <= 8; id++) save(id, "yes");
        finalizer.finalizeExpiredUnfinishedAttempt(attempt, started.plusSeconds(60));
        assertEquals(80, attempt.getScorePercent());
        assertTrue(attempt.getPassed());
        assertEquals(8, items.stream().filter(TrainingExamAttemptQuestion::isCorrect).count());
        assertNull(items.get(8).getChosenAnswerJson());
        verify(assignmentService).reconcileDerivedStateFromFinishedAttempts(assignment);
    }

    @Test void lateSubmitScoresOnlyServerAnswersAndDoesNotAcceptLateAnswers() {
        save(1L, "yes");
        finalizer.finalizeUserSubmission(attempt, Map.of(2L, new SubmitAttemptAnswerDto(2L, "\"yes\"")), started.plusSeconds(60));
        assertEquals(10, attempt.getScorePercent());
        assertNull(items.get(1).getChosenAnswerJson());
    }

    @Test void confirmationIsImmutableButLostAcknowledgementCanBeRetriedAfterDeadline() {
        save(1L, "yes");
        TimeProvider.setClock(Clock.fixed(started.plusSeconds(61), ZoneOffset.UTC));
        assertDoesNotThrow(() -> save(1L, "yes"));
        assertThrows(ConflictException.class, () -> save(1L, "no"));
        assertThrows(ConflictException.class, () -> save(2L, "yes"));
        assertEquals("\"yes\"", items.get(0).getChosenAnswerJson());
    }

    @Test void submissionCannotOverwriteConfirmedAnswers() {
        save(1L, "yes");
        finalizer.finalizeUserSubmission(attempt, Map.of(1L, new SubmitAttemptAnswerDto(1L, "\"no\"")), started.plusSeconds(20));
        assertEquals(10, attempt.getScorePercent());
        assertEquals("\"yes\"", items.get(0).getChosenAnswerJson());
    }

    @Test void rejectsForeignQuestionsInvalidValuesAndCompletedAttempts() {
        assertThrows(BadRequestException.class, () -> save(99L, "yes"));
        assertThrows(BadRequestException.class, () -> save(1L, "other"));
        assertThrows(BadRequestException.class, () -> finalizer.saveAnswer(attempt, new SubmitAttemptAnswerDto(1L, null)));
        attempt.setFinishedAt(started.plusSeconds(5));
        assertThrows(ConflictException.class, () -> save(1L, "yes"));
    }

    @Test void savesAndFinalizationAcquireAssignmentBeforeAttempt() {
        save(1L, "yes");
        var order = inOrder(assignments, attempts, entityManager);
        order.verify(assignments).findByIdAndRestaurantIdForFinalizationUpdate(20L, 1L);
        order.verify(entityManager).refresh(assignment, LockModeType.PESSIMISTIC_WRITE);
        order.verify(attempts).findByIdAndRestaurantIdForFinalizationUpdate(30L, 1L);
        order.verify(entityManager).refresh(attempt, LockModeType.PESSIMISTIC_WRITE);
    }

    @Test void practiceTimeoutAlsoRetainsConfirmedAnswersAndRejectsLatePayload() {
        exam.setMode(TrainingExamMode.PRACTICE);
        save(1L, "yes");
        finalizer.finalizeUserSubmission(attempt, Map.of(2L, new SubmitAttemptAnswerDto(2L, "\"yes\"")), started.plusSeconds(60));
        assertEquals(10, attempt.getScorePercent());
        verifyNoInteractions(assignments, assignmentService);
    }

    @Test void answerEndpointRequiresRealMembershipAndAttemptOwnership() {
        var policy = mock(TrainingPolicyService.class);
        var service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "trainingPolicyService", policy);
        ReflectionTestUtils.setField(service, "attempts", attempts);
        ReflectionTestUtils.setField(service, "certificationAttemptFinalizationService", finalizer);
        when(attempts.findByIdAndRestaurantId(30L, 1L)).thenReturn(Optional.of(attempt));
        assertThrows(ForbiddenException.class, () -> service.saveAttemptAnswer(1L, 30L, 8L, new SubmitAttemptAnswerDto(1L, "\"yes\"")));
        assertNull(items.get(0).getChosenAnswerJson());
        doThrow(new ForbiddenException("Not a member")).when(policy).assertActiveTrainingMember(7L, 1L);
        assertThrows(ForbiddenException.class, () -> service.saveAttemptAnswer(1L, 30L, 7L, new SubmitAttemptAnswerDto(1L, "\"yes\"")));
    }

    @Test void resumeReturnsConfirmedAnswersWithoutRevealingCorrectKeys() {
        save(1L, "no");
        var service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(service, "attemptQuestions", questions);
        ReflectionTestUtils.setField(service, "snapshotService", new ExamSnapshotService(mapper));
        ReflectionTestUtils.setField(service, "certificationAssignmentService", assignmentService);
        StartExamResponseDto response = ReflectionTestUtils.invokeMethod(service, "resumeAttempt", exam, attempt);
        assertNotNull(response);
        assertEquals(List.of(new SubmitAttemptAnswerDto(1L, "\"no\"")), response.savedAnswers());
        assertEquals(10, response.questions().size());
        assertNull(response.questions().get(0).explanation());
        assertEquals(List.of(new TrainingQuestionOptionViewDto(0, "yes"), new TrainingQuestionOptionViewDto(1, "no")),
                response.questions().get(0).options());
        assertNull(attempt.getFinishedAt());
        assertFalse(items.get(0).isCorrect());
    }

    @Test void repeatedFinalizationPreservesTheOriginalResult() {
        save(1L, "yes");
        var first = finalizer.finalizeUserSubmission(attempt, Map.of(), started.plusSeconds(20));
        var second = finalizer.finalizeUserSubmission(attempt,
                Map.of(2L, new SubmitAttemptAnswerDto(2L, "\"yes\"")), started.plusSeconds(25));
        assertTrue(first.newlyFinalized());
        assertFalse(second.newlyFinalized());
        assertEquals(10, attempt.getScorePercent());
        assertEquals(started.plusSeconds(20), attempt.getFinishedAt());
        assertNull(items.get(1).getChosenAnswerJson());
    }
}
