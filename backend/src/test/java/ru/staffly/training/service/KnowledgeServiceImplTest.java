package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InjectMocks;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.CreateTrainingKnowledgeItemRequest;
import ru.staffly.training.dto.MoveTrainingKnowledgeItemRequest;
import ru.staffly.training.dto.ReorderTrainingObjectsRequest;
import ru.staffly.training.model.TrainingFolder;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.model.TrainingKnowledgeItem;
import ru.staffly.training.model.TrainingObjectKind;
import ru.staffly.training.repository.*;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class KnowledgeServiceImplTest {
    @Mock TrainingFolderRepository folders;
    @Mock TrainingKnowledgeItemRepository items;
    @Mock TrainingImageStorage storage;
    @Mock TrainingExamSourceFolderRepository folderSources;
    @Mock TrainingExamRepository exams;
    @Mock TrainingQuestionRepository questions;
    @Mock EntityManager entityManager;
    @Mock PositionRepository positions;
    @Mock TrainingPolicyService trainingPolicyService;
    @InjectMocks KnowledgeServiceImpl service;

    @Test
    void createCardAppendsAfterCardsOnly() {
        when(items.maxSortOrderInFolder(1L, null)).thenReturn(2);
        when(items.save(any())).thenAnswer(invocation -> invocation.getArgument(0));

        var result = service.createKnowledgeItem(1L, 7L,
                new CreateTrainingKnowledgeItemRequest(null, "New", null, null, null, null, null));

        assertEquals(3, result.sortOrder());
        verifyNoInteractions(folders, exams);
    }

    @Test
    void moveCardAppendsAfterCardsOnly() {
        var target = folder(20L);
        var card = card(9L, null, 50);
        when(items.findByIdAndRestaurantId(9L, 1L)).thenReturn(Optional.of(card));
        when(folders.findByIdAndRestaurantIdWithVisibility(20L, 1L)).thenReturn(Optional.of(target));
        when(items.maxSortOrderInFolder(1L, 20L)).thenReturn(2);
        when(items.save(card)).thenReturn(card);

        var result = service.moveKnowledgeItem(1L, 7L, 9L, new MoveTrainingKnowledgeItemRequest(20L, null));

        assertEquals(20L, result.folderId());
        assertEquals(3, result.sortOrder());
        verifyNoInteractions(exams);
    }

    @Test
    void reorderCardsNormalizesOrder() {
        var a = card(1L, null, 10);
        var b = card(2L, null, 20);
        var c = card(3L, null, 30);
        var d = card(4L, null, 40);
        when(items.findByIdAndRestaurantId(anyLong(), eq(1L))).thenAnswer(invocation -> {
            long id = invocation.getArgument(0);
            return Optional.of(id == 1L ? a : id == 2L ? b : id == 3L ? c : d);
        });

        service.reorderObjects(1L, 7L, new ReorderTrainingObjectsRequest(
                TrainingFolderType.KNOWLEDGE, null, TrainingObjectKind.KNOWLEDGE_ITEM, List.of(3L, 1L, 4L, 2L)));

        assertAll(() -> assertEquals(0, c.getSortOrder()), () -> assertEquals(1, a.getSortOrder()),
                () -> assertEquals(2, d.getSortOrder()), () -> assertEquals(3, b.getSortOrder()));
    }

    @Test
    void invalidReordersNeverPartiallyChangeOrder() {
        assertThrows(BadRequestException.class, () -> service.reorderObjects(1L, 7L,
                new ReorderTrainingObjectsRequest(TrainingFolderType.KNOWLEDGE, null,
                        TrainingObjectKind.KNOWLEDGE_ITEM, List.of(1L, 1L))));

        var existing = card(1L, null, 12);
        when(items.findByIdAndRestaurantId(1L, 1L)).thenReturn(Optional.of(existing));
        when(items.findByIdAndRestaurantId(999L, 1L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.reorderObjects(1L, 7L,
                new ReorderTrainingObjectsRequest(TrainingFolderType.KNOWLEDGE, null,
                        TrainingObjectKind.KNOWLEDGE_ITEM, List.of(1L, 999L))));
        assertEquals(12, existing.getSortOrder());

        var otherFolder = folder(30L);
        var misplaced = card(2L, otherFolder, 22);
        when(items.findByIdAndRestaurantId(2L, 1L)).thenReturn(Optional.of(misplaced));
        when(folders.findByIdAndRestaurantIdWithVisibility(30L, 1L)).thenReturn(Optional.of(otherFolder));
        assertThrows(BadRequestException.class, () -> service.reorderObjects(1L, 7L,
                new ReorderTrainingObjectsRequest(TrainingFolderType.KNOWLEDGE, null,
                        TrainingObjectKind.KNOWLEDGE_ITEM, List.of(1L, 2L))));
        assertEquals(12, existing.getSortOrder());

        // An ID from another restaurant is deliberately indistinguishable from a missing ID.
        when(items.findByIdAndRestaurantId(88L, 1L)).thenReturn(Optional.empty());
        assertThrows(NotFoundException.class, () -> service.reorderObjects(1L, 7L,
                new ReorderTrainingObjectsRequest(TrainingFolderType.KNOWLEDGE, null,
                        TrainingObjectKind.KNOWLEDGE_ITEM, List.of(88L))));
    }

    private TrainingFolder folder(long id) {
        return TrainingFolder.builder().id(id).restaurant(Restaurant.builder().id(1L).build())
                .type(TrainingFolderType.KNOWLEDGE).name("Folder").active(true).build();
    }

    private TrainingKnowledgeItem card(long id, TrainingFolder folder, int order) {
        return TrainingKnowledgeItem.builder().id(id).restaurant(Restaurant.builder().id(1L).build())
                .folder(folder).title("Card " + id).sortOrder(order).active(true).build();
    }
}
