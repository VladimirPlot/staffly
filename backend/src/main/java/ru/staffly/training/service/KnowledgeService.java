package ru.staffly.training.service;

import org.springframework.web.multipart.MultipartFile;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.model.TrainingFolderType;

import java.io.IOException;
import java.util.List;

public interface KnowledgeService {
    List<TrainingFolderDto> listFolders(Long restaurantId, Long userId, TrainingFolderType type, boolean includeInactive);
    List<QuestionBankTreeNodeDto> getQuestionBankTree(Long restaurantId, Long userId, TrainingExamMode mode, boolean includeInactive);
    TrainingFolderDto createFolder(Long restaurantId, Long userId, CreateTrainingFolderRequest request);
    TrainingFolderDto updateFolder(Long restaurantId, Long userId, Long folderId, UpdateTrainingFolderRequest request);
    TrainingFolderDto hideFolder(Long restaurantId, Long userId, Long folderId);
    TrainingFolderDto restoreFolder(Long restaurantId, Long userId, Long folderId);
    void deleteFolder(Long restaurantId, Long userId, Long folderId);

    List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long userId, Long folderId, boolean includeInactive);
    TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, Long userId, CreateTrainingKnowledgeItemRequest request);
    TrainingKnowledgeItemDto updateKnowledgeItem(Long restaurantId, Long userId, Long itemId, UpdateTrainingKnowledgeItemRequest request);
    TrainingKnowledgeItemDto hideKnowledgeItem(Long restaurantId, Long userId, Long itemId);
    TrainingKnowledgeItemDto restoreKnowledgeItem(Long restaurantId, Long userId, Long itemId);
    void deleteKnowledgeItem(Long restaurantId, Long userId, Long itemId);
    TrainingKnowledgeItemDto uploadKnowledgeImage(Long restaurantId, Long userId, Long itemId, MultipartFile file) throws IOException;
    TrainingKnowledgeItemDto deleteKnowledgeImage(Long restaurantId, Long userId, Long itemId) throws IOException;
}
