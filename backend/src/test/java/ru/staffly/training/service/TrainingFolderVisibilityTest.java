package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

class TrainingFolderVisibilityTest {
    final TrainingFolderRepository folders = mock(TrainingFolderRepository.class);
    final TrainingKnowledgeItemRepository items = mock(TrainingKnowledgeItemRepository.class);
    final TrainingQuestionRepository questions = mock(TrainingQuestionRepository.class);
    final TrainingExamRepository exams = mock(TrainingExamRepository.class);
    final TrainingPolicyService policy = mock(TrainingPolicyService.class);
    final ExamService examService = mock(ExamService.class);
    final KnowledgeServiceImpl service = mock(KnowledgeServiceImpl.class, CALLS_REAL_METHODS);
    final List<TrainingFolder> tree = new ArrayList<>();
    final List<TrainingKnowledgeItem> cards = new ArrayList<>();
    final List<TrainingQuestion> bank = new ArrayList<>();
    final List<TrainingExam> certifications = new ArrayList<>();
    final Restaurant restaurant = Restaurant.builder().id(1L).build();

    TrainingFolderVisibilityTest() {
        ReflectionTestUtils.setField(service, "folders", folders);
        ReflectionTestUtils.setField(service, "items", items);
        ReflectionTestUtils.setField(service, "questions", questions);
        ReflectionTestUtils.setField(service, "exams", exams);
        ReflectionTestUtils.setField(service, "trainingPolicyService", policy);
        ReflectionTestUtils.setField(service, "entityManager", mock(EntityManager.class));
        ReflectionTestUtils.setField(service, "lifecycleMutex", mock(RestaurantLifecycleMutex.class));
        ReflectionTestUtils.setField(service, "folderSources", mock(TrainingExamSourceFolderRepository.class));
        ReflectionTestUtils.setField(service, "questionSources", mock(TrainingExamSourceQuestionRepository.class));
        ReflectionTestUtils.setField(service, "certificationFolderManagementService", mock(CertificationFolderManagementService.class));
        ReflectionTestUtils.setField(service, "examService", examService);
        ReflectionTestUtils.setField(service, "activeContainerValidator", new TrainingActiveContainerValidator());
        when(folders.findByIdAndRestaurantIdWithVisibility(anyLong(), eq(1L))).thenAnswer(call -> tree.stream()
                .filter(folder -> folder.getId().equals(call.getArgument(0))).findFirst());
        when(folders.findByRestaurantIdAndType(eq(1L), any())).thenReturn(tree);
        when(folders.findAllByRestaurantIdAndIdInWithVisibility(eq(1L), anyList())).thenAnswer(call -> {
            List<Long> ids = call.getArgument(1);
            return tree.stream().filter(folder -> ids.contains(folder.getId())).toList();
        });
        when(folders.save(any())).thenAnswer(call -> call.getArgument(0));
        when(items.save(any())).thenAnswer(call -> call.getArgument(0));
        when(items.findByIdAndRestaurantId(anyLong(), eq(1L))).thenAnswer(call -> cards.stream()
                .filter(item -> item.getId().equals(call.getArgument(0))).findFirst());
        when(items.findByRestaurantIdAndFolderIdIn(eq(1L), anyList())).thenAnswer(call -> {
            List<Long> ids = call.getArgument(1);
            return cards.stream().filter(item -> ids.contains(item.getFolder().getId())).toList();
        });
        when(questions.findByRestaurantIdAndFolderIdIn(eq(1L), anyList())).thenAnswer(call -> {
            List<Long> ids = call.getArgument(1);
            return bank.stream().filter(question -> ids.contains(question.getFolder().getId())).toList();
        });
        when(exams.findCertificationByRestaurantIdAndFolderIdIn(eq(1L), anyList())).thenAnswer(call -> {
            List<Long> ids = call.getArgument(1);
            return certifications.stream().filter(exam -> ids.contains(exam.getFolder().getId())).toList();
        });
        doAnswer(call -> {
            var exam = certifications.stream().filter(value -> value.getId().equals(call.getArgument(2))).findFirst().orElseThrow();
            exam.setActive(false); exam.setHiddenByFolderId(null); return null;
        }).when(examService).hideExam(eq(1L), eq(7L), anyLong());
        doAnswer(call -> {
            var exam = certifications.stream().filter(value -> value.getId().equals(call.getArgument(2))).findFirst().orElseThrow();
            assertTrue(exam.getFolder().isActive());
            exam.setActive(true); exam.setHiddenByFolderId(null); return null;
        }).when(examService).restoreExam(eq(1L), eq(7L), anyLong());
    }

    TrainingFolder folder(long id, TrainingFolder parent, TrainingFolderType type) {
        var result = TrainingFolder.builder().id(id).name("Folder " + id).restaurant(restaurant).parent(parent).type(type).build();
        tree.add(result); return result;
    }

    void content(TrainingFolder folder) {
        cards.add(TrainingKnowledgeItem.builder().id(folder.getId()).title("Card").restaurant(restaurant).folder(folder).build());
        cards.add(TrainingKnowledgeItem.builder().id(folder.getId() + 100).title("Hidden card").restaurant(restaurant).folder(folder).active(false).build());
        bank.add(TrainingQuestion.builder().id(folder.getId()).restaurant(restaurant).folder(folder).build());
        bank.add(TrainingQuestion.builder().id(folder.getId() + 100).restaurant(restaurant).folder(folder).active(false).build());
        certifications.add(TrainingExam.builder().id(folder.getId()).restaurant(restaurant).folder(folder).mode(TrainingExamMode.CERTIFICATION).build());
        certifications.add(TrainingExam.builder().id(folder.getId() + 100).restaurant(restaurant).folder(folder).mode(TrainingExamMode.CERTIFICATION).active(false).build());
    }

    void assertContent(TrainingFolderType type, boolean visible) {
        switch (type) {
            case KNOWLEDGE -> { assertEquals(visible, cards.get(0).isActive()); assertFalse(cards.get(1).isActive()); }
            case QUESTION_BANK -> { assertEquals(visible, bank.get(0).isActive()); assertFalse(bank.get(1).isActive()); }
            case CERTIFICATION -> { assertEquals(visible, certifications.get(0).isActive()); assertFalse(certifications.get(1).isActive()); }
        }
    }

    @ParameterizedTest @EnumSource(TrainingFolderType.class)
    void parentRestorePreservesIndependentFoldersAndObjects(TrainingFolderType type) {
        var root = folder(10, null, type);
        var visible = folder(11, root, type);
        var hidden = folder(12, root, type);
        var descendant = folder(13, hidden, type);
        content(visible);
        service.hideFolder(1L, 7L, hidden.getId());
        service.hideFolder(1L, 7L, root.getId());
        service.hideFolder(1L, 7L, root.getId());
        assertContent(type, false);
        service.restoreFolder(1L, 7L, root.getId());
        assertTrue(root.isActive()); assertTrue(visible.isActive());
        assertFalse(hidden.isActive()); assertFalse(descendant.isActive());
        assertContent(type, true);
        service.restoreFolder(1L, 7L, root.getId());
        assertFalse(hidden.isActive());
        service.restoreFolder(1L, 7L, hidden.getId());
        assertTrue(descendant.isActive());
        if (type == TrainingFolderType.CERTIFICATION) {
            verify(examService, times(1)).restoreExam(1L, 7L, visible.getId());
            verify(examService, never()).restoreExam(1L, 7L, visible.getId() + 100);
        }
    }

    @ParameterizedTest @EnumSource(TrainingFolderType.class)
    void independentlyHidingAChildWhileParentHiddenTransfersItsInheritedDescendants(TrainingFolderType type) {
        var root = folder(10, null, type);
        var child = folder(11, root, type);
        var descendant = folder(12, child, type);
        content(descendant);
        service.hideFolder(1L, 7L, root.getId());
        service.hideFolder(1L, 7L, child.getId());
        service.restoreFolder(1L, 7L, root.getId());
        assertFalse(child.isActive()); assertFalse(descendant.isActive()); assertContent(type, false);
        service.restoreFolder(1L, 7L, child.getId());
        assertTrue(descendant.isActive()); assertContent(type, true);
    }

    @Test void legacyHiddenChildrenRemainHiddenUntilExplicitRestore() {
        var root = folder(10, null, TrainingFolderType.KNOWLEDGE);
        var child = folder(11, root, root.getType());
        root.setActive(false); child.setActive(false); content(child);
        cards.get(0).setActive(false);
        service.restoreFolder(1L, 7L, root.getId());
        assertTrue(root.isActive()); assertFalse(child.isActive()); assertFalse(cards.get(0).isActive());
    }

    @Test void independentlyHidingInheritedCardPreventsParentRestoreFromRevealingIt() {
        var root = folder(10, null, TrainingFolderType.KNOWLEDGE);
        var child = folder(11, root, root.getType()); content(child);
        service.hideFolder(1L, 7L, 10L);
        assertEquals(10L, cards.get(0).getHiddenByFolderId());
        service.hideKnowledgeItem(1L, 7L, 11L);
        assertNull(cards.get(0).getHiddenByFolderId());
        service.restoreFolder(1L, 7L, 10L);
        assertTrue(child.isActive()); assertFalse(cards.get(0).isActive());
    }

    @Test void navigationUsesUnfilteredSubtreeForManagementFlag() {
        var root = folder(10, null, TrainingFolderType.QUESTION_BANK);
        var child = folder(11, root, root.getType()); child.setActive(false);
        child.setVisibilityPositions(Set.of(Position.builder().id(99L).build()));
        when(policy.canManageTraining(7L, 1L)).thenReturn(true);
        when(policy.canAccessManagementFolder(7L, 1L, root)).thenReturn(true);
        when(folders.findByRestaurantIdAndTypeAndActiveTrueWithVisibilityOrderBySortOrderAscNameAsc(1L, root.getType()))
                .thenReturn(List.of(root));
        when(folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(1L, root.getType())).thenReturn(tree);
        var visible = service.listFolders(1L, 7L, root.getType(), false);
        assertEquals(1, visible.size()); assertFalse(visible.get(0).manageable());
    }

    @Test void unauthorizedHiddenChildBlocksParentMutationBeforeAnyChange() {
        var root = folder(10, null, TrainingFolderType.QUESTION_BANK);
        var child = folder(11, root, root.getType());
        child.setActive(false);
        child.setVisibilityPositions(Set.of(Position.builder().id(99L).build()));
        doThrow(new ForbiddenException("Outside management scope")).when(policy)
                .assertCanAccessManagementFolder(7L, 1L, child);
        assertThrows(ForbiddenException.class, () -> service.hideFolder(1L, 7L, 10L));
        assertTrue(root.isActive()); assertFalse(child.isActive());
        assertThrows(ForbiddenException.class, () -> service.moveFolder(1L, 7L, 10L,
                new ru.staffly.training.dto.MoveTrainingFolderRequest(null, null)));
        assertThrows(ForbiddenException.class, () -> service.updateFolder(1L, 7L, 10L,
                new ru.staffly.training.dto.UpdateTrainingFolderRequest("Changed", null, null, List.of())));
        assertEquals("Folder 10", root.getName());
        root.setActive(false);
        assertThrows(ForbiddenException.class, () -> service.restoreFolder(1L, 7L, 10L));
        assertThrows(ForbiddenException.class, () -> service.deleteFolder(1L, 7L, 10L));
        verify(folders, never()).delete(any());
    }
}
