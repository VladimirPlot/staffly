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
    final TrainingFolderRepository bankFolders = mock(TrainingFolderRepository.class);
    final CertificationQuestionSnapshotService service = new CertificationQuestionSnapshotService(
            folders, explicit, questions, options, pairs, blanks, blankOptions, snapshots, mapper, mock(EntityManager.class), bankFolders);
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
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folderId(2L)
                        .pickMode(TrainingExamSourcePickMode.RANDOM).randomCount(1).build()))
                .questionSources(List.of(CertificationAssessmentQuestionSource.builder()
                        .questionId(10L).build())).build();
        var resolver = new ExamQuestionPoolResolver(folders, explicit, questions, mock(TrainingFolderRepository.class),
                mock(TrainingPolicyService.class), mock(TrainingActiveContainerValidator.class), service);
        var pool = resolver.buildQuestionPool(1L, specification);
        assertEquals(Set.of(10L, 11L), new HashSet<>(pool.questions().stream().map(TrainingQuestion::getId).toList()));
        assertEquals(Set.of(10L), pool.mandatoryQuestionIds());
        verifyNoInteractions(questions, folders, explicit, options, pairs, blanks, blankOptions);
    }

    @Test void publicationPersistsHistoricalIdsAndKeepsRandomSelectionRules() {
        capture();
        exam.setQuestionCount(2);
        when(explicit.findByExamId(3L)).thenReturn(List.of(TrainingExamSourceQuestion.builder()
                .question(TrainingQuestion.builder().id(10L).build()).build()));
        var specifications = mock(CertificationAssessmentSpecificationRepository.class);
        var publishedFolders = mock(CertificationAssessmentFolderSourceRepository.class);
        var publishedQuestions = mock(CertificationAssessmentQuestionSourceRepository.class);
        when(specifications.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(publishedFolders.saveAll(any())).thenAnswer(call -> call.getArgument(0));
        when(publishedQuestions.saveAll(any())).thenAnswer(call -> call.getArgument(0));
        var resolver = new ExamQuestionPoolResolver(folders, explicit, questions, mock(TrainingFolderRepository.class),
                mock(TrainingPolicyService.class), mock(TrainingActiveContainerValidator.class), service);
        var publisher = new CertificationAssessmentSpecificationService(specifications, publishedFolders,
                publishedQuestions, folders, explicit, service, resolver);

        var specification = publisher.createCurrent(exam);
        assertEquals(2L, specification.getFolderSources().get(0).getFolderId());
        assertEquals(TrainingExamSourcePickMode.RANDOM, specification.getFolderSources().get(0).getPickMode());
        assertEquals(1, specification.getFolderSources().get(0).getRandomCount());
        assertEquals(10L, specification.getQuestionSources().get(0).getQuestionId());
        clearInvocations(questions, folders, explicit, options, pairs, blanks, blankOptions);
        // IDs in the publication are sufficient even when no live sources are available.
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
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folderId(2L)
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
        clearInvocations(questions, options);
        assertFalse(specificationService.materialDiff(exam, definitions, List.of(), 1, 70, null, null, false).materialChanged());
        verifyNoInteractions(questions, options);
    }

    @Test void frozenRecursiveMembershipSurvivesMovingTheLiveQuestionAndLegacyJsonStillWorks() {
        String json = """
                [{"questionId":10,"folderId":9,"snapshotJson":"{}","correctKeyJson":"null","sourceFolderIds":[2]}]
                """;
        var specification = CertificationAssessmentSpecification.builder().questionPoolJson(json)
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folderId(2L)
                        .includeDescendants(true).pickMode(TrainingExamSourcePickMode.ALL).build())).build();
        var resolver = new ExamQuestionPoolResolver(folders, explicit, questions, mock(TrainingFolderRepository.class),
                mock(TrainingPolicyService.class), mock(TrainingActiveContainerValidator.class), service);
        assertEquals(List.of(10L), resolver.buildQuestionPool(1L, specification).questions().stream().map(TrainingQuestion::getId).toList());
        assertTrue(service.read("[{\"questionId\":10,\"folderId\":2,\"snapshotJson\":\"{}\",\"correctKeyJson\":\"null\"}]").get(0).belongsTo(2L));
        assertTrue(service.sameContent(
                "[{\"questionId\":10,\"folderId\":2,\"snapshotJson\":\"{}\",\"correctKeyJson\":\"null\"}]",
                "[{\"questionId\":10,\"folderId\":2,\"snapshotJson\":\"{}\",\"correctKeyJson\":\"null\",\"sourceFolderIds\":[]}]"));
        verifyNoInteractions(questions, folders, explicit);
    }
    @Test void recursivePublicationTagsChildQuestionsWithTheirSelectedParentSource() {
        var child = TrainingFolder.builder().id(9L).parent(folder).build();
        when(bankFolders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(1L, TrainingFolderType.QUESTION_BANK))
                .thenReturn(List.of(folder, child));
        when(folders.findByExamId(3L)).thenReturn(List.of(TrainingExamSourceFolder.builder().folder(folder)
                .pickMode(TrainingExamSourcePickMode.ALL).includeDescendants(true).build()));
        var question = TrainingQuestion.builder().id(20L).folder(child).type(TrainingQuestionType.SINGLE)
                .prompt("Child question").questionGroup(TrainingQuestionGroup.CERTIFICATION).build();
        when(questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(1L, 9L, TrainingQuestionGroup.CERTIFICATION))
                .thenReturn(List.of(question));
        var frozen = service.read(service.capture(exam));
        assertEquals(1, frozen.size());
        assertEquals(9L, frozen.get(0).folderId()); assertEquals(List.of(2L), frozen.get(0).sourceFolderIds());
        assertTrue(frozen.get(0).belongsTo(2L)); assertFalse(frozen.get(0).belongsTo(9L));
    }

    @Test void ruleVersionCopiesPublishedSourcesEvenWhenLiveReferencesAreGone() {
        var json = capture();
        var old = CertificationAssessmentSpecification.builder().questionPoolJson(json)
                .folderSources(List.of(CertificationAssessmentFolderSource.builder().folderId(2L)
                        .pickMode(TrainingExamSourcePickMode.RANDOM).randomCount(1).build())).build();
        exam.setVersion(2); exam.setQuestionCount(1); exam.setPassPercent(90);
        var repository = mock(CertificationAssessmentSpecificationRepository.class);
        var publishedFolders = mock(CertificationAssessmentFolderSourceRepository.class);
        var publishedQuestions = mock(CertificationAssessmentQuestionSourceRepository.class);
        when(repository.saveAndFlush(any())).thenAnswer(call -> call.getArgument(0));
        when(publishedFolders.saveAll(any())).thenAnswer(call -> call.getArgument(0));
        when(publishedQuestions.saveAll(any())).thenAnswer(call -> call.getArgument(0));
        var resolver = new ExamQuestionPoolResolver(folders, explicit, questions, mock(TrainingFolderRepository.class),
                mock(TrainingPolicyService.class), mock(TrainingActiveContainerValidator.class), service);
        var publisher = new CertificationAssessmentSpecificationService(repository, publishedFolders, publishedQuestions,
                folders, explicit, service, resolver);
        clearInvocations(questions, folders, explicit);
        var created = publisher.createCurrent(exam, old);
        assertEquals(json, created.getQuestionPoolJson());
        assertEquals(90, created.getPassPercent());
        assertEquals(2L, created.getFolderSources().get(0).getFolderId());
        verifyNoInteractions(questions, folders, explicit);
    }
}
