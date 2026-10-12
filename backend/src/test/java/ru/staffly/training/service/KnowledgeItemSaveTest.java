package ru.staffly.training.service;

import com.fasterxml.jackson.databind.ObjectMapper;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.mock.web.MockMultipartFile;
import org.springframework.test.util.ReflectionTestUtils;
import org.springframework.transaction.annotation.AnnotationTransactionAttributeSource;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.media.TrainingImageStorage;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.SaveTrainingKnowledgeItemRequest;
import ru.staffly.training.model.TrainingKnowledgeItem;
import ru.staffly.training.repository.TrainingKnowledgeItemRepository;

import java.io.IOException;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class KnowledgeItemSaveTest {
    final TrainingKnowledgeItemRepository items = mock(TrainingKnowledgeItemRepository.class);
    final TrainingImageStorage storage = mock(TrainingImageStorage.class);
    final TrainingPolicyService policy = mock(TrainingPolicyService.class);
    final KnowledgeServiceImpl service = mock(KnowledgeServiceImpl.class, CALLS_REAL_METHODS);
    final UUID key = UUID.randomUUID();
    final TrainingKnowledgeItem existing = TrainingKnowledgeItem.builder().id(5L)
            .restaurant(Restaurant.builder().id(1L).build()).title("Original").imageUrl("old-photo").build();
    final MockMultipartFile image = new MockMultipartFile("image", "photo.png", "image/png",
            new byte[] {(byte) 0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0});
    TrainingKnowledgeItem created;

    @BeforeEach void setup() throws IOException {
        TransactionSynchronizationManager.initSynchronization();
        ReflectionTestUtils.setField(service, "items", items);
        ReflectionTestUtils.setField(service, "storage", storage);
        ReflectionTestUtils.setField(service, "trainingPolicyService", policy);
        ReflectionTestUtils.setField(service, "lifecycleMutex", mock(RestaurantLifecycleMutex.class));
        ReflectionTestUtils.setField(service, "objectMapper", new ObjectMapper());
        ReflectionTestUtils.setField(service, "activeContainerValidator", mock(TrainingActiveContainerValidator.class));
        ReflectionTestUtils.setField(service, "activeContainerValidator", mock(TrainingActiveContainerValidator.class));
        when(items.findByIdAndRestaurantId(5L, 1L)).thenReturn(Optional.of(existing));
        when(items.findByRestaurantIdAndCreationRequestId(1L, key)).thenAnswer(call -> Optional.ofNullable(created));
        when(items.saveAndFlush(any())).thenAnswer(call -> {
            TrainingKnowledgeItem value = call.getArgument(0);
            if (value.getId() == null) { value.setId(6L); created = value; }
            return value;
        });
        when(items.findByIdAndRestaurantId(6L, 1L)).thenAnswer(call -> Optional.ofNullable(created));
        when(storage.saveForItem(anyLong(), any())).thenReturn("new-photo");
    }

    @AfterEach void cleanup() { TransactionSynchronizationManager.clearSynchronization(); }

    SaveTrainingKnowledgeItemRequest request(Long id, String title, boolean removeImage) {
        return new SaveTrainingKnowledgeItemRequest(key, id, null, title, "Description", null, null, null, removeImage);
    }

    void complete(int status) {
        TransactionSynchronizationManager.getSynchronizations().forEach(callback -> callback.afterCompletion(status));
    }

    @Test void retryAfterLostAcknowledgementReturnsTheSameCardWithoutUploadingAgain() throws IOException {
        var request = request(null, "Created", false);
        var first = service.saveKnowledgeItem(1L, 7L, request, image);
        var replay = service.saveKnowledgeItem(1L, 7L, request, image);
        assertEquals(first.id(), replay.id()); assertEquals("new-photo", replay.imageUrl());
        verify(items, times(1)).saveAndFlush(any());
        verify(storage, times(1)).saveForItem(6L, image);
    }

    @Test void replayCannotOverwriteCardThatWasSubsequentlyEdited() throws IOException {
        var request = request(null, "Created", false);
        service.saveKnowledgeItem(1L, 7L, request, null);
        created.setTitle("Edited by someone else");
        assertEquals("Edited by someone else", service.saveKnowledgeItem(1L, 7L, request, null).title());
        assertThrows(ConflictException.class, () -> service.saveKnowledgeItem(1L, 7L, request(null, "Different", false), null));
        verify(items, times(1)).saveAndFlush(any());
    }

    @Test void oldImageIsRetiredOnlyAfterSuccessfulCommit() throws IOException {
        var saved = service.saveKnowledgeItem(1L, 7L, request(5L, "Updated", false), image);
        assertEquals("Updated", saved.title()); assertEquals("new-photo", saved.imageUrl());
        verify(storage, never()).deleteByPublicUrl(any());
        complete(TransactionSynchronization.STATUS_COMMITTED);
        verify(storage).deleteByPublicUrl("old-photo");
        verify(storage, never()).deleteByPublicUrl("new-photo");
    }

    @Test void databaseRollbackCleansNewUploadAndPreservesOldFile() throws IOException {
        service.saveKnowledgeItem(1L, 7L, request(5L, "Updated", false), image);
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(storage).deleteByPublicUrl("new-photo");
        verify(storage, never()).deleteByPublicUrl("old-photo");
    }

    @Test void failedUploadDoesNotDeleteTheOldPhotoAndCheckedIoErrorRollsBackDatabase() throws Exception {
        when(storage.saveForItem(5L, image)).thenThrow(new IOException("Upload failed"));
        assertThrows(IOException.class, () -> service.saveKnowledgeItem(1L, 7L, request(5L, "Updated", false), image));
        assertEquals("old-photo", existing.getImageUrl());
        verify(storage, never()).deleteByPublicUrl(any());
        var method = KnowledgeServiceImpl.class.getMethod("saveKnowledgeItem", Long.class, Long.class,
                SaveTrainingKnowledgeItemRequest.class, org.springframework.web.multipart.MultipartFile.class);
        assertTrue(new AnnotationTransactionAttributeSource().getTransactionAttribute(method, KnowledgeServiceImpl.class)
                .rollbackOn(new IOException("failed")));
    }

    @Test void deletingImageIsDeferredAndRollbackKeepsTheFile() throws IOException {
        assertNull(service.saveKnowledgeItem(1L, 7L, request(5L, "Updated", true), null).imageUrl());
        verify(storage, never()).deleteByPublicUrl(any());
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verify(storage, never()).deleteByPublicUrl(any());
    }

    @Test void uncertainCommitRetainsBothFilesRatherThanBreakingTheSavedReference() throws IOException {
        service.saveKnowledgeItem(1L, 7L, request(5L, "Updated", false), image);
        complete(TransactionSynchronization.STATUS_UNKNOWN);
        verify(storage, never()).deleteByPublicUrl(any());
    }

    @Test void failedCardDeletionPreservesImages() {
        existing.setActive(false);
        service.deleteKnowledgeItem(1L, 7L, 5L);
        verify(items).delete(existing);
        verifyNoInteractions(storage);
        complete(TransactionSynchronization.STATUS_ROLLED_BACK);
        verifyNoInteractions(storage);
    }

    @Test void committedCardDeletionRetiresItsImageFolder() {
        existing.setActive(false);
        service.deleteKnowledgeItem(1L, 7L, 5L);
        verifyNoInteractions(storage);
        complete(TransactionSynchronization.STATUS_COMMITTED);
        verify(storage).deleteByPublicUrl("old-photo");
        verify(storage).deleteItemFolder(5L);
    }

    @Test void deleteImageCommitRetiresOnlyPreviousFile() throws IOException {
        service.deleteKnowledgeImage(1L, 7L, 5L);
        verify(storage, never()).deleteByPublicUrl(any());
        complete(TransactionSynchronization.STATUS_COMMITTED);
        verify(storage).deleteByPublicUrl("old-photo");
    }

    @Test void invalidPhotoAndContradictoryActionDoNotPersistAnything() {
        var invalid = new MockMultipartFile("image", "bad.png", "image/png", new byte[12]);
        assertThrows(BadRequestException.class, () -> service.saveKnowledgeItem(1L, 7L, request(null, "Created", false), invalid));
        assertThrows(BadRequestException.class, () -> service.saveKnowledgeItem(1L, 7L, request(null, "Created", true), image));
        verify(items, never()).saveAndFlush(any()); verifyNoInteractions(storage);
    }

    @Test void replayStillRequiresCurrentManagementAuthority() throws IOException {
        var request = request(null, "Created", false);
        service.saveKnowledgeItem(1L, 7L, request, null);
        doThrow(new ForbiddenException("Locked restaurant")).when(policy).assertRestaurantUnlocked(8L, 1L);
        assertThrows(ForbiddenException.class, () -> service.saveKnowledgeItem(1L, 8L, request, null));
        verify(items, times(1)).saveAndFlush(any());
    }
}
