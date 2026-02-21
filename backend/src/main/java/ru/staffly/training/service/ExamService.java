package ru.staffly.training.service;

import ru.staffly.training.dto.TrainingExamAttemptDto;
import ru.staffly.training.dto.TrainingExamDto;
import ru.staffly.training.dto.TrainingExamSubmitRequest;

import java.util.List;

public interface ExamService {
    List<TrainingExamDto> listExams(Long restaurantId);
    TrainingExamDto createExam(Long restaurantId, TrainingExamDto dto);
    TrainingExamDto updateExam(Long restaurantId, Long examId, TrainingExamDto dto);
    void deleteExam(Long restaurantId, Long examId);
    TrainingExamAttemptDto startExam(Long restaurantId, Long examId, Long userId);
    TrainingExamAttemptDto submitAttempt(Long restaurantId, Long attemptId, Long userId, TrainingExamSubmitRequest request);
}
