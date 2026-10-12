package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.ExamUsageDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.training.repository.projection.TrainingExamUsageProjection;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class TrainingSourceDeletionTest {
    final TrainingFolderRepository folders = mock(TrainingFolderRepository.class);
    final TrainingQuestionRepository questions = mock(TrainingQuestionRepository.class);
    final TrainingExamSourceFolderRepository liveFolders = mock(TrainingExamSourceFolderRepository.class);
    final TrainingExamSourceQuestionRepository liveQuestions = mock(TrainingExamSourceQuestionRepository.class);
    final TrainingPolicyService policy = mock(TrainingPolicyService.class);
    final TrainingQuestionNestedPersistence nested = mock(TrainingQuestionNestedPersistence.class);
    final QuestionServiceImpl questionService = mock(QuestionServiceImpl.class, CALLS_REAL_METHODS);
    final KnowledgeServiceImpl knowledgeService = mock(KnowledgeServiceImpl.class, CALLS_REAL_METHODS);
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final TrainingFolder root = TrainingFolder.builder().id(20L).restaurant(restaurant)
            .type(TrainingFolderType.QUESTION_BANK).active(false).build();
    final TrainingQuestion question = TrainingQuestion.builder().id(10L).folder(root)
            .restaurant(restaurant).active(false).build();

    @BeforeEach void setup() {
        for (Object service : List.of(questionService, knowledgeService)) {
            ReflectionTestUtils.setField(service, "folders", folders);
            ReflectionTestUtils.setField(service, "questions", questions);
            ReflectionTestUtils.setField(service, "questionSources", liveQuestions);
            ReflectionTestUtils.setField(service, "folderSources", liveFolders);
            ReflectionTestUtils.setField(service, "trainingPolicyService", policy);
            ReflectionTestUtils.setField(service, "lifecycleMutex", mock(RestaurantLifecycleMutex.class));
        }
        ReflectionTestUtils.setField(questionService, "nestedPersistence", nested);
        ReflectionTestUtils.setField(questionService, "entityManager", mock(EntityManager.class));
        ReflectionTestUtils.setField(knowledgeService, "items", mock(TrainingKnowledgeItemRepository.class));
        when(questions.findByIdAndRestaurantIdWithFolderVisibility(10L, 1L)).thenReturn(Optional.of(question));
        when(folders.findByIdAndRestaurantIdWithVisibility(20L, 1L)).thenReturn(Optional.of(root));
        when(folders.findByRestaurantIdAndType(1L, TrainingFolderType.QUESTION_BANK)).thenReturn(List.of(root));
        when(folders.findAllByRestaurantIdAndIdInWithVisibility(1L, List.of(20L))).thenReturn(List.of(root));
    }

    @Test void unusedHiddenQuestionCanBeDeleted() {
        questionService.deleteQuestion(1L, 7L, 10L);
        verify(nested).clearNested(10L);
        verify(questions).delete(question);
    }

    @Test void currentSourceBlocksQuestionDeletionEvenIfTheTestIsHidden() {
        when(liveQuestions.findExamUsagesByRestaurantIdAndQuestionId(1L, 10L))
                .thenReturn(List.of(mock(TrainingExamUsageProjection.class)));
        assertThrows(ConflictException.class, () -> questionService.deleteQuestion(1L, 7L, 10L));
        verifyNoInteractions(nested);
        verify(questions, never()).delete(any());
    }

    @Test void activeQuestionMustBeHiddenBeforeDeletion() {
        question.setActive(true);
        assertThrows(ConflictException.class, () -> questionService.deleteQuestion(1L, 7L, 10L));
        verifyNoInteractions(nested);
        verify(questions, never()).delete(any());
    }

    @Test void unusedHiddenBankFolderCanBeDeleted() {
        knowledgeService.deleteFolder(1L, 7L, 20L);
        verify(folders).delete(root);
    }

    @Test void currentFolderSelectionBlocksSubtreeDeletion() {
        when(liveFolders.findExamUsagesByRestaurantIdAndFolderIds(1L, List.of(20L)))
                .thenReturn(List.of(new ExamUsageDto(30L, "Current test")));
        assertThrows(ConflictException.class, () -> knowledgeService.deleteFolder(1L, 7L, 20L));
        verify(folders, never()).delete(any());
    }

    @Test void explicitlySelectedQuestionBlocksItsFolderDeletion() {
        when(liveQuestions.findExamUsagesByRestaurantIdAndQuestionFolderIds(1L, List.of(20L)))
                .thenReturn(List.of(mock(TrainingExamUsageProjection.class)));
        assertThrows(ConflictException.class, () -> knowledgeService.deleteFolder(1L, 7L, 20L));
        verify(folders, never()).delete(any());
    }
}
