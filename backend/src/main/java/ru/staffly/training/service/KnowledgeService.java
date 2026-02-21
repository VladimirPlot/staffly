package ru.staffly.training.service;

import org.springframework.web.multipart.MultipartFile;
import ru.staffly.training.dto.TrainingFolderDto;
import ru.staffly.training.dto.TrainingKnowledgeItemDto;
import ru.staffly.training.model.TrainingFolderType;

import java.io.IOException;
import java.util.List;

public interface KnowledgeService {
    List<TrainingFolderDto> listFolders(Long restaurantId, TrainingFolderType type);
    TrainingFolderDto createFolder(Long restaurantId, TrainingFolderDto dto);
    TrainingFolderDto updateFolder(Long restaurantId, Long folderId, TrainingFolderDto dto);
    void deleteFolder(Long restaurantId, Long folderId);

    List<TrainingKnowledgeItemDto> listKnowledgeItems(Long restaurantId, Long folderId);
    TrainingKnowledgeItemDto createKnowledgeItem(Long restaurantId, TrainingKnowledgeItemDto dto);
    TrainingKnowledgeItemDto updateKnowledgeItem(Long restaurantId, Long itemId, TrainingKnowledgeItemDto dto);
    void deleteKnowledgeItem(Long restaurantId, Long itemId);
    TrainingKnowledgeItemDto uploadKnowledgeImage(Long restaurantId, Long itemId, MultipartFile file) throws IOException;
    TrainingKnowledgeItemDto deleteKnowledgeImage(Long restaurantId, Long itemId) throws IOException;
}
