package ru.staffly.training.service;

import ru.staffly.training.dto.*;

import java.util.List;

public interface QuestionService {
    List<TrainingQuestionDto> listQuestions(Long restaurantId, Long folderId, boolean includeInactive);
    TrainingQuestionDto createQuestion(Long restaurantId, CreateTrainingQuestionRequest request);
    TrainingQuestionDto updateQuestion(Long restaurantId, Long questionId, UpdateTrainingQuestionRequest request);
    TrainingQuestionDto hideQuestion(Long restaurantId, Long questionId);
    TrainingQuestionDto restoreQuestion(Long restaurantId, Long questionId);
    void deleteQuestion(Long restaurantId, Long questionId);
}
