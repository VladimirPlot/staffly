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
    TrainingFolderDto createFolder(Long restaurantId, CreateTrainingFolderRequest request);
    TrainingFolderDto updateFolder(Long restaurantId, Long folderId, UpdateTrainingFolderRequest request);
    TrainingFolderDto hideFolder(Long restaurantId, Long folderId);
    TrainingFolderDto restoreFolder(Long restaurantId, Long folderId);
    void deleteFolder(Long restaurantId, Long folderId);

    List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long userId, Long folderId, boolean includeInactive);
    TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, CreateTrainingKnowledgeItemRequest request);
    TrainingKnowledgeItemDto updateKnowledgeItem(Long restaurantId, Long itemId, UpdateTrainingKnowledgeItemRequest request);
    TrainingKnowledgeItemDto hideKnowledgeItem(Long restaurantId, Long itemId);
    TrainingKnowledgeItemDto restoreKnowledgeItem(Long restaurantId, Long itemId);
    void deleteKnowledgeItem(Long restaurantId, Long itemId);
    TrainingKnowledgeItemDto uploadKnowledgeImage(Long restaurantId, Long itemId, MultipartFile file) throws IOException;
    TrainingKnowledgeItemDto deleteKnowledgeImage(Long restaurantId, Long itemId) throws IOException;
}
