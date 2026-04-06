package ru.staffly.training.service;

import ru.staffly.training.dto.*;

import ru.staffly.training.model.TrainingQuestionGroup;

import java.util.List;

public interface QuestionService {
    List<TrainingQuestionDto> listQuestions(Long restaurantId, Long userId, Long folderId, TrainingQuestionGroup questionGroup, boolean includeInactive, String query);
    TrainingQuestionDto createQuestion(Long restaurantId, Long userId, CreateTrainingQuestionRequest request);
    TrainingQuestionDto updateQuestion(Long restaurantId, Long userId, Long questionId, UpdateTrainingQuestionRequest request);
    TrainingQuestionDto hideQuestion(Long restaurantId, Long userId, Long questionId);
    TrainingQuestionDto restoreQuestion(Long restaurantId, Long userId, Long questionId);
    void deleteQuestion(Long restaurantId, Long userId, Long questionId);
}
