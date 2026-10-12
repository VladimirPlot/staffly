package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.dto.ExamSourceFolderDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class RecursiveExamSourcesTest {
    final TrainingQuestionRepository questions = mock(TrainingQuestionRepository.class);
    final TrainingFolderRepository folders = mock(TrainingFolderRepository.class);
    final TrainingFolder root = TrainingFolder.builder().id(1L).name("Root").type(TrainingFolderType.QUESTION_BANK).build();
    final TrainingFolder child = TrainingFolder.builder().id(2L).name("Child").parent(root).type(TrainingFolderType.QUESTION_BANK).build();
    final ExamQuestionPoolResolver resolver = new ExamQuestionPoolResolver(mock(TrainingExamSourceFolderRepository.class),
            mock(TrainingExamSourceQuestionRepository.class), questions, folders, mock(TrainingPolicyService.class),
            new TrainingActiveContainerValidator(), mock(CertificationQuestionSnapshotService.class));
    void setup() {
        when(folders.findByIdAndRestaurantIdWithVisibility(1L, 9L)).thenReturn(Optional.of(root));
        when(folders.findByIdAndRestaurantIdWithVisibility(2L, 9L)).thenReturn(Optional.of(child));
        when(folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(9L, TrainingFolderType.QUESTION_BANK)).thenReturn(List.of(root, child));
        when(questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(9L, 2L, TrainingQuestionGroup.CERTIFICATION))
                .thenReturn(List.of(question(10), question(11)));
    }
    TrainingQuestion question(long id) {
        return TrainingQuestion.builder().id(id).title("Question").folder(child).questionGroup(TrainingQuestionGroup.CERTIFICATION).build();
    }
    @Test void emptyParentCanSelectAllOrRandomFromItsDescendantsButDirectScopeStaysEmpty() {
        setup();
        assertEquals(2, resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.ALL, null, true)), List.of()));
        assertEquals(1, resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.RANDOM, 1, true)), List.of()));
        assertThrows(BadRequestException.class, () -> resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.ALL, null)), List.of()));
    }
    @Test void mandatoryQuestionsAreCountedOnceAndExcludedFromRandomCandidates() {
        setup();
        when(questions.findByIdAndRestaurantIdWithFolderVisibility(10L, 9L)).thenReturn(Optional.of(question(10)));
        assertEquals(2, resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.RANDOM, 1, true)), List.of(10L)));
        assertThrows(BadRequestException.class, () -> resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.RANDOM, 2, true)), List.of(10L)));
        assertEquals(2, resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.ALL, null, true)), List.of(10L)));
    }
    @Test void overlappingScopesCannotChangeTheEffectiveSizeOfRandomSelections() {
        setup();
        assertThrows(BadRequestException.class, () -> resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.ALL, null, true),
                        new ExamSourceFolderDto(2L, TrainingExamSourcePickMode.RANDOM, 1)), List.of()));
    }
    @Test void directParentAndChildCanBothContributeQuestions() {
        setup();
        when(questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(9L, 1L, TrainingQuestionGroup.CERTIFICATION))
                .thenReturn(List.of(TrainingQuestion.builder().id(20L).folder(root).build()));
        assertEquals(3, resolver.resolveAvailableQuestionCount(9L, 7L, TrainingExamMode.CERTIFICATION,
                List.of(new ExamSourceFolderDto(1L, TrainingExamSourcePickMode.ALL, null),
                        new ExamSourceFolderDto(2L, TrainingExamSourcePickMode.ALL, null)), List.of()));
    }
}
