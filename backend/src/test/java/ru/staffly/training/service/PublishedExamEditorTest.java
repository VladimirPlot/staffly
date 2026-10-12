package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class PublishedExamEditorTest {
    final ExamServiceImpl service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
    final TrainingExamRepository exams = mock(TrainingExamRepository.class);
    final TrainingExamSourceFolderRepository folders = mock(TrainingExamSourceFolderRepository.class);
    final TrainingExamSourceQuestionRepository questions = mock(TrainingExamSourceQuestionRepository.class);
    final ExamQuestionPoolResolver pool = mock(ExamQuestionPoolResolver.class);
    final CertificationQuestionSnapshotService snapshots = mock(CertificationQuestionSnapshotService.class);
    final CertificationAssessmentSpecificationRepository specs = mock(CertificationAssessmentSpecificationRepository.class);
    final EntityManager em = mock(EntityManager.class);
    final Position waiter = Position.builder().id(1L).build();
    final TrainingExam exam = TrainingExam.builder().id(3L).restaurant(Restaurant.builder().id(1L).build())
            .mode(TrainingExamMode.CERTIFICATION).title("Old").version(1).editorRevision(4L)
            .questionCount(1).passPercent(80).attemptLimit(2).visibilityPositions(new HashSet<>(Set.of(waiter))).build();
    final List<ExamSourceFolderDto> definitions = List.of(new ExamSourceFolderDto(5L, TrainingExamSourcePickMode.ALL, null));

    @BeforeEach void setup() {
        when(exams.findByIdAndRestaurantIdWithVisibility(3L, 1L)).thenReturn(Optional.of(exam));
        var published = CertificationAssessmentSpecification.builder().exam(exam).version(1).questionCount(1)
                .passPercent(80).attemptLimit(2).questionPoolJson("published")
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folderId(5L).pickMode(TrainingExamSourcePickMode.ALL).build())).build();
        when(specs.findByExamIdAndVersion(3L, 1)).thenReturn(Optional.of(published));
        var specificationService = new CertificationAssessmentSpecificationService(specs,
                mock(CertificationAssessmentFolderSourceRepository.class), mock(CertificationAssessmentQuestionSourceRepository.class),
                folders, questions, snapshots, pool);
        var positions = mock(PositionRepository.class);
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(waiter));
        ReflectionTestUtils.setField(service, "exams", exams);
        ReflectionTestUtils.setField(service, "entityManager", em);
        ReflectionTestUtils.setField(service, "sourceFolders", folders);
        ReflectionTestUtils.setField(service, "sourceQuestions", questions);
        ReflectionTestUtils.setField(service, "positions", positions);
        ReflectionTestUtils.setField(service, "questionPoolResolver", pool);
        ReflectionTestUtils.setField(service, "certificationSpecificationService", specificationService);
        ReflectionTestUtils.setField(service, "trainingPolicyService", mock(TrainingPolicyService.class));
        ReflectionTestUtils.setField(service, "lifecycleMutex", mock(RestaurantLifecycleMutex.class));
    }
    @Test void titleUpdateKeepsPublishedQuestionsWithoutReadingOrReplacingEmptyLiveSources() {
        var request = new UpdateTrainingExamRequest(4L, "Renamed", null, 1, 80, null, TrainingExamMode.CERTIFICATION,
                null, null, 2, null, List.of(1L), definitions, List.of(), false, false, false);
        var result = service.updateExam(1L, 7L, 3L, request);
        assertEquals("Renamed", result.title()); assertEquals(1, result.version());
        assertEquals(definitions, result.sourcesFolders());
        verifyNoInteractions(pool, snapshots);
        verify(folders, never()).deleteByExamId(anyLong());
        verify(questions, never()).deleteByExamId(anyLong());
    }
    @Test void preflightUsesPublishedCountAndDoesNotAcquireMutationLocks() {
        var request = new ExamSourcesPreflightRequest(TrainingExamMode.CERTIFICATION, null, definitions, List.of(),
                null, null, null, 3L, 4L, false);
        var result = service.preflightSources(1L, 7L, request);
        assertTrue(result.valid()); assertEquals(1, result.availableQuestionCount());
        verifyNoInteractions(pool, snapshots, em);
    }
    @Test void explicitRefreshValidatesTheCurrentBankAndReportsEmptySources() {
        when(pool.resolveAvailableQuestionCount(1L, 7L, TrainingExamMode.CERTIFICATION, definitions, List.of()))
                .thenThrow(new ru.staffly.common.exception.BadRequestException("Источник пуст"));
        var request = new ExamSourcesPreflightRequest(TrainingExamMode.CERTIFICATION, null, definitions, List.of(),
                null, null, null, 3L, 4L, true);
        var result = service.preflightSources(1L, 7L, request);
        assertFalse(result.valid()); assertEquals(List.of("Источник пуст"), result.issues());
    }
    @Test void staleEditorCannotPreflightOrSaveAnOutdatedPublishedVersion() {
        var request = new ExamSourcesPreflightRequest(TrainingExamMode.CERTIFICATION, null, definitions, List.of(),
                null, null, null, 3L, 3L, false);
        assertThrows(ru.staffly.training.exception.StaleExamRevisionException.class, () -> service.preflightSources(1L, 7L, request));
        verifyNoInteractions(pool, snapshots, em);
    }
}
