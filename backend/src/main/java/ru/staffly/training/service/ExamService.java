package ru.staffly.training.service;

import ru.staffly.training.dto.*;

import java.util.List;

public interface ExamService {
    List<TrainingExamDto> listExams(Long restaurantId, Long userId, boolean isManager, boolean includeInactive, Boolean certificationOnly);
    List<CurrentUserCertificationExamDto> listCurrentUserCertificationExams(Long restaurantId, Long userId);
    CertificationMyResultDto getCurrentUserCertificationResult(Long restaurantId, Long examId, Long userId, boolean isManager);
    List<TrainingExamDto> listPracticeExamsByKnowledgeFolder(Long restaurantId, Long userId, boolean isManager, Long folderId, boolean includeInactive);
    TrainingExamDto createExam(Long restaurantId, Long userId, CreateTrainingExamRequest request);
    TrainingExamDto createKnowledgeExam(Long restaurantId, Long userId, CreateTrainingExamRequest request);
    TrainingExamDto updateExam(Long restaurantId, Long userId, Long examId, UpdateTrainingExamRequest request);
    TrainingExamDto hideExam(Long restaurantId, Long userId, Long examId);
    TrainingExamDto restoreExam(Long restaurantId, Long userId, Long examId);
    void deleteExam(Long restaurantId, Long userId, Long examId);
    void resetCertificationExamCycle(Long restaurantId, Long userId, Long examId);
    List<TrainingExamProgressDto> listCurrentUserPracticeExamProgress(Long restaurantId, Long userId);
    StartExamResponseDto startExam(Long restaurantId, Long examId, Long userId, boolean isManager);
    AttemptResultDto submitAttempt(Long restaurantId, Long attemptId, Long userId, SubmitAttemptRequestDto request);

    void resetEmployeeCertificationAttempts(Long restaurantId, Long actorUserId, Long examId, Long userId);
    void grantEmployeeCertificationExtraAttempts(Long restaurantId, Long actorUserId, Long examId, Long userId, Integer amount);

    CertificationExamSummaryDto getCertificationExamSummary(Long restaurantId, Long actorUserId, Long examId);
    List<CertificationExamPositionBreakdownDto> getCertificationExamPositionBreakdown(Long restaurantId, Long actorUserId, Long examId);
    List<CertificationExamEmployeeRowDto> getCertificationExamEmployeeTable(Long restaurantId, Long actorUserId, Long examId);
    List<CertificationExamAttemptHistoryDto> getCertificationEmployeeAttemptHistory(Long restaurantId, Long actorUserId, Long examId, Long userId);
}
