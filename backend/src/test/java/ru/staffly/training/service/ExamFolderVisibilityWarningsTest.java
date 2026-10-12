package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import org.springframework.test.util.ReflectionTestUtils;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.training.dto.ExamSourcesPreflightRequest;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingFolderRepository;

import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ExamFolderVisibilityWarningsTest {
    final Position waiter = Position.builder().id(1L).name("Официант").build();
    final Position bartender = Position.builder().id(2L).name("Бармен").build();
    final Position cleaner = Position.builder().id(3L).name("Уборщица").build();
    final TrainingFolder folder = TrainingFolder.builder().id(5L).name("Меню").type(TrainingFolderType.KNOWLEDGE)
            .visibilityPositions(Set.of(waiter)).build();

    @Test void warningNamesOnlyTheExcludedAudienceAndDoesNotImplyFailedAssignments() {
        var warnings = ExamFolderVisibilityWarnings.build(TrainingExamMode.CERTIFICATION, folder, List.of(waiter, bartender, cleaner));
        assertEquals(1, warnings.size());
        assertTrue(warnings.get(0).contains("Бармен, Уборщица"));
        assertFalse(warnings.get(0).contains("Официант"));
        assertTrue(warnings.get(0).contains("Назначенная аттестация остаётся доступной"));
    }

    @Test void anUnrestrictedChildStillInheritsItsParentRestrictions() {
        var child = TrainingFolder.builder().id(6L).name("Напитки").parent(folder).build();
        assertFalse(ExamFolderVisibilityWarnings.build(TrainingExamMode.PRACTICE, child, List.of(bartender)).isEmpty());
        assertTrue(ExamFolderVisibilityWarnings.build(TrainingExamMode.PRACTICE, child, List.of(waiter)).isEmpty());
    }

    @Test void unrestrictedFoldersRootAndMatchingAudienceDoNotWarn() {
        assertTrue(ExamFolderVisibilityWarnings.build(TrainingExamMode.CERTIFICATION, null, List.of(bartender)).isEmpty());
        var open = TrainingFolder.builder().id(6L).name("Общее").build();
        assertTrue(ExamFolderVisibilityWarnings.build(TrainingExamMode.PRACTICE, open, List.of(bartender)).isEmpty());
        assertTrue(ExamFolderVisibilityWarnings.build(TrainingExamMode.PRACTICE, folder, List.of(waiter)).isEmpty());
    }

    @Test void conflictingAncestorScopesAndCyclesAreHandled() {
        var child = TrainingFolder.builder().id(6L).name("Напитки").parent(folder).visibilityPositions(Set.of(bartender)).build();
        assertTrue(ExamFolderVisibilityWarnings.build(TrainingExamMode.PRACTICE, child, List.of(waiter, bartender)).get(0).contains("Бармен, Официант"));
        folder.setParent(child);
        assertThrows(BadRequestException.class, () -> ExamFolderVisibilityWarnings.build(TrainingExamMode.PRACTICE, child, List.of(waiter)));
    }

    @Test void aVisibilityMismatchRemainsAValidPreflightAndLegacyCountOnlyCallsStillWork() {
        var service = mock(ExamServiceImpl.class, CALLS_REAL_METHODS);
        var folders = mock(TrainingFolderRepository.class);
        var positions = mock(PositionRepository.class);
        var pool = mock(ExamQuestionPoolResolver.class);
        ReflectionTestUtils.setField(service, "folders", folders);
        ReflectionTestUtils.setField(service, "positions", positions);
        ReflectionTestUtils.setField(service, "questionPoolResolver", pool);
        ReflectionTestUtils.setField(service, "trainingPolicyService", mock(TrainingPolicyService.class));
        ReflectionTestUtils.setField(service, "activeContainerValidator", new TrainingActiveContainerValidator());
        ReflectionTestUtils.setField(service, "activeContainerValidator", new TrainingActiveContainerValidator());
        when(pool.resolveAvailableQuestionCount(1L, 7L, TrainingExamMode.PRACTICE, List.of(), List.of(10L))).thenReturn(1);
        when(folders.findByIdAndRestaurantIdWithVisibility(5L, 1L)).thenReturn(Optional.of(folder));
        when(positions.findByRestaurantId(1L)).thenReturn(List.of(waiter, bartender, cleaner));
        var result = service.preflightSources(1L, 7L, new ExamSourcesPreflightRequest(TrainingExamMode.PRACTICE, null, List.of(), List.of(10L), 5L, null, List.of()));
        assertTrue(result.valid()); assertEquals(1, result.availableQuestionCount());
        assertFalse(result.folderVisibilityWarnings().isEmpty()); assertTrue(result.issues().isEmpty());
        var legacy = service.preflightSources(1L, 7L, new ExamSourcesPreflightRequest(TrainingExamMode.PRACTICE, null, List.of(), List.of(10L)));
        assertTrue(legacy.valid()); assertTrue(legacy.folderVisibilityWarnings().isEmpty());
    }
}
