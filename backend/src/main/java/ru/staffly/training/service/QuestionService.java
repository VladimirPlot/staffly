package ru.staffly.training.service;

import ru.staffly.training.dto.TrainingQuestionDto;

import java.util.List;

public interface QuestionService {
    List<TrainingQuestionDto> listQuestions(Long restaurantId, Long folderId);
    TrainingQuestionDto createQuestion(Long restaurantId, TrainingQuestionDto dto);
    TrainingQuestionDto updateQuestion(Long restaurantId, Long questionId, TrainingQuestionDto dto);
    void deleteQuestion(Long restaurantId, Long questionId);
}
