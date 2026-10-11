package ru.staffly.training.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CertificationQuestionSnapshotTest {
    final ObjectMapper mapper = new ObjectMapper();
    final TrainingExamSourceFolderRepository folders = mock(TrainingExamSourceFolderRepository.class);
    final TrainingExamSourceQuestionRepository explicit = mock(TrainingExamSourceQuestionRepository.class);
    final TrainingQuestionRepository questions = mock(TrainingQuestionRepository.class);
    final TrainingQuestionOptionRepository options = mock(TrainingQuestionOptionRepository.class);
    final TrainingQuestionMatchPairRepository pairs = mock(TrainingQuestionMatchPairRepository.class);
    final TrainingQuestionBlankRepository blanks = mock(TrainingQuestionBlankRepository.class);
    final TrainingQuestionBlankOptionRepository blankOptions = mock(TrainingQuestionBlankOptionRepository.class);
    final ExamSnapshotService snapshots = new ExamSnapshotService(mapper);
    final CertificationQuestionSnapshotService service = new CertificationQuestionSnapshotService(
            folders, explicit, questions, options, pairs, blanks, blankOptions, snapshots, mapper, mock(EntityManager.class));
    final TrainingFolder folder = TrainingFolder.builder().id(2L).build();
    final TrainingExam exam = TrainingExam.builder().id(3L).restaurant(Restaurant.builder().id(1L).build())
            .mode(TrainingExamMode.CERTIFICATION).version(1).build();

    String capture() {
        when(folders.findByExamId(3L)).thenReturn(List.of(TrainingExamSourceFolder.builder()
                .folder(folder).pickMode(TrainingExamSourcePickMode.RANDOM).randomCount(1).build()));
        var first = TrainingQuestion.builder().id(10L).folder(folder).type(TrainingQuestionType.SINGLE)
                .prompt("Original").questionGroup(TrainingQuestionGroup.CERTIFICATION).build();
        var second = TrainingQuestion.builder().id(11L).folder(folder).type(TrainingQuestionType.SINGLE)
                .prompt("Second").questionGroup(TrainingQuestionGroup.CERTIFICATION).build();
        when(questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(1L, 2L, TrainingQuestionGroup.CERTIFICATION))
                .thenReturn(List.of(first, second));
        when(options.findByQuestionIdInOrderBySortOrderAscIdAsc(List.of(10L, 11L))).thenReturn(List.of(
                TrainingQuestionOption.builder().question(first).text("yes").correct(true).build()));
        return service.capture(exam);
    }

    @Test void publicationCapturesAllRandomCandidatesAndChangesAreDetected() {
        var published = capture();
        assertEquals(2, service.read(published).size());
        assertTrue(service.sameContent(published, capture()));
        when(options.findByQuestionIdInOrderBySortOrderAscIdAsc(List.of(10L, 11L))).thenReturn(List.of(
                TrainingQuestionOption.builder().question(TrainingQuestion.builder().id(10L).build()).text("no").correct(true).build()));
        assertFalse(service.sameContent(published, service.capture(exam)));
        assertEquals("\"yes\"", service.read(published).get(0).correctKeyJson());
    }

    @Test void sqlBackfillAndJacksonContentCompareWithoutWhitespaceOrObjectOrderDifferences() throws Exception {
        var published = capture();
        var tree = mapper.readTree(published);
        for (var entry : tree) {
            ((com.fasterxml.jackson.databind.node.ObjectNode) entry).put("snapshotJson",
                    mapper.writerWithDefaultPrettyPrinter().writeValueAsString(mapper.readTree(entry.get("snapshotJson").asText())));
        }
        assertTrue(service.sameContent(published, mapper.writeValueAsString(tree)));
    }

    @Test void attemptsSelectFromFrozenCandidatesWithoutReadingTheBank() {
        var json = capture();
        clearInvocations(questions, folders, explicit, options, pairs, blanks, blankOptions);
        var specification = CertificationAssessmentSpecification.builder().exam(exam).questionPoolJson(json)
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folder(folder)
                        .pickMode(TrainingExamSourcePickMode.RANDOM).randomCount(1).build()))
                .questionSources(List.of(CertificationAssessmentQuestionSource.builder()
                        .question(TrainingQuestion.builder().id(10L).build()).build())).build();
        var resolver = new ExamQuestionPoolResolver(folders, explicit, questions, mock(TrainingFolderRepository.class),
                mock(TrainingPolicyService.class), mock(TrainingActiveContainerValidator.class), service);
        var pool = resolver.buildQuestionPool(1L, specification);
        assertEquals(Set.of(10L, 11L), new HashSet<>(pool.questions().stream().map(TrainingQuestion::getId).toList()));
        assertEquals(Set.of(10L), pool.mandatoryQuestionIds());
        verifyNoInteractions(questions, folders, explicit, options, pairs, blanks, blankOptions);
    }

    @Test void attemptsPersistOriginalPromptAndKeyWithoutBankReference() throws Exception {
        var json = capture();
        var specification = CertificationAssessmentSpecification.builder().questionPoolJson(json).build();
        var attemptQuestions = mock(TrainingExamAttemptQuestionRepository.class);
        var examService = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        ReflectionTestUtils.setField(examService, "certificationQuestionSnapshots", service);
        ReflectionTestUtils.setField(examService, "snapshotService", snapshots);
        ReflectionTestUtils.setField(examService, "attemptQuestions", attemptQuestions);
        var selected = List.of(TrainingQuestion.builder().id(10L).prompt("Changed in bank").build());
        @SuppressWarnings("unchecked")
        List<AttemptQuestionSnapshotDto> result = ReflectionTestUtils.invokeMethod(examService,
                "persistPublishedQuestions", TrainingExamAttempt.builder().id(5L).build(), selected, specification);
        assertEquals("Original", result.get(0).prompt());
        var captor = org.mockito.ArgumentCaptor.forClass(Iterable.class);
        verify(attemptQuestions).saveAll(captor.capture());
        var entity = (TrainingExamAttemptQuestion) captor.getValue().iterator().next();
        assertNull(entity.getQuestion());
        assertEquals("\"yes\"", entity.getCorrectKeyJson());
    }

    @Test void missingSnapshotsNeverFallBackToLiveBank() {
        assertThrows(IllegalStateException.class, () -> service.read(null));
        assertThrows(IllegalStateException.class, () -> service.read("invalid"));
    }

    @Test void changingOnlyBankAnswerKeysRequiresANewMaterialVersion() {
        var json = capture();
        var specification = CertificationAssessmentSpecification.builder().exam(exam).version(1)
                .questionCount(1).passPercent(70).questionPoolJson(json)
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folder(folder)
                        .pickMode(TrainingExamSourcePickMode.RANDOM).randomCount(1).build())).build();
        var repository = mock(CertificationAssessmentSpecificationRepository.class);
        when(repository.findByExamIdAndVersion(3L, 1)).thenReturn(Optional.of(specification));
        var specificationService = new CertificationAssessmentSpecificationService(repository,
                mock(CertificationAssessmentFolderSourceRepository.class), mock(CertificationAssessmentQuestionSourceRepository.class),
                folders, explicit, service, mock(ExamQuestionPoolResolver.class));
        var definitions = List.of(new ExamSourceFolderDto(2L, TrainingExamSourcePickMode.RANDOM, 1));
        assertFalse(specificationService.materialDiff(exam, definitions, List.of(), 1, 70, null, null).materialChanged());
        when(options.findByQuestionIdInOrderBySortOrderAscIdAsc(List.of(10L, 11L))).thenReturn(List.of(
                TrainingQuestionOption.builder().question(TrainingQuestion.builder().id(10L).build())
                        .text("yes").correct(false).build()));
        var diff = specificationService.materialDiff(exam, definitions, List.of(), 1, 70, null, null);
        assertTrue(diff.materialChanged());
        assertEquals(List.of("questionContent"), diff.changedFields());
    }
}
