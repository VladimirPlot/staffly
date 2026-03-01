package ru.staffly.training.service;

import ru.staffly.training.dto.*;

import java.util.List;

public interface ExamService {
    List<TrainingExamDto> listExams(Long restaurantId, Long userId, boolean isManager, boolean includeInactive, Boolean certificationOnly);
    List<TrainingExamDto> listPracticeExamsByKnowledgeFolder(Long restaurantId, Long userId, boolean isManager, Long folderId, boolean includeInactive);
    TrainingExamDto createExam(Long restaurantId, CreateTrainingExamRequest request);
    TrainingExamDto createKnowledgeExam(Long restaurantId, CreateTrainingExamRequest request);
    TrainingExamDto updateExam(Long restaurantId, Long examId, UpdateTrainingExamRequest request);
    TrainingExamDto hideExam(Long restaurantId, Long examId);
    TrainingExamDto restoreExam(Long restaurantId, Long examId);
    void deleteExam(Long restaurantId, Long examId);
    void resetExamResults(Long restaurantId, Long examId);
    List<TrainingExamProgressDto> listCurrentUserExamProgress(Long restaurantId, Long userId);
    StartExamResponseDto startExam(Long restaurantId, Long examId, Long userId, boolean isManager);
    AttemptResultDto submitAttempt(Long restaurantId, Long attemptId, Long userId, SubmitAttemptRequestDto request);
    List<TrainingExamResultDto> listExamResults(Long restaurantId, Long examId, Long positionId);
}
