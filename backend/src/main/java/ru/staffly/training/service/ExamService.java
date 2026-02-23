package ru.staffly.training.service;

import ru.staffly.training.dto.*;

import java.util.List;

public interface ExamService {
    List<TrainingExamDto> listExams(Long restaurantId, boolean includeInactive);
    TrainingExamDto createExam(Long restaurantId, CreateTrainingExamRequest request);
    TrainingExamDto updateExam(Long restaurantId, Long examId, UpdateTrainingExamRequest request);
    void deleteExam(Long restaurantId, Long examId);
    StartExamResponseDto startExam(Long restaurantId, Long examId, Long userId);
    AttemptResultDto submitAttempt(Long restaurantId, Long attemptId, Long userId, SubmitAttemptRequestDto request);
}
