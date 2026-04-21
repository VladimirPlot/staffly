package ru.staffly.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.security.SecurityService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.model.TrainingQuestionGroup;
import ru.staffly.training.service.ExamService;
import ru.staffly.training.service.CertificationEmployeeAnalyticsService;
import ru.staffly.training.service.KnowledgeService;
import ru.staffly.training.service.QuestionService;
import ru.staffly.training.service.TrainingPolicyService;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/training")
@RequiredArgsConstructor
public class TrainingController {
    private final KnowledgeService knowledgeService;
    private final QuestionService questionService;
    private final ExamService examService;
    private final CertificationEmployeeAnalyticsService certificationEmployeeAnalyticsService;
    private final SecurityService securityService;
    private final TrainingPolicyService trainingPolicyService;

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/folders")
    public List<TrainingFolderDto> listFolders(@PathVariable Long restaurantId,
                                               @AuthenticationPrincipal UserPrincipal principal,
                                               @RequestParam TrainingFolderType type,
                                               @RequestParam(defaultValue = "false") boolean includeInactive) {
        if (type == TrainingFolderType.QUESTION_BANK && !trainingPolicyService.canManageTraining(principal.userId(), restaurantId)) {
            throw new ForbiddenException("Only managers can access question bank");
        }
        return knowledgeService.listFolders(restaurantId, principal.userId(), type, includeInactive);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/question-bank/tree")
    public List<QuestionBankTreeNodeDto> getQuestionBankTree(@PathVariable Long restaurantId,
                                                             @AuthenticationPrincipal UserPrincipal principal,
                                                             @RequestParam TrainingExamMode mode,
                                                             @RequestParam(defaultValue = "false") boolean includeInactive) {
        return knowledgeService.getQuestionBankTree(restaurantId, principal.userId(), mode, includeInactive);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/folders")
    public TrainingFolderDto createFolder(@PathVariable Long restaurantId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody CreateTrainingFolderRequest request) {
        return knowledgeService.createFolder(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PutMapping("/folders/{folderId}")
    public TrainingFolderDto updateFolder(@PathVariable Long restaurantId,
                                          @PathVariable Long folderId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody UpdateTrainingFolderRequest request) {
        return knowledgeService.updateFolder(restaurantId, principal.userId(), folderId, request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/folders/{folderId}/hide")
    public TrainingFolderDto hideFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.hideFolder(restaurantId, principal.userId(), folderId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/folders/{folderId}/restore")
    public TrainingFolderDto restoreFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.restoreFolder(restaurantId, principal.userId(), folderId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @DeleteMapping("/folders/{folderId}")
    public void deleteFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @AuthenticationPrincipal UserPrincipal principal) {
        knowledgeService.deleteFolder(restaurantId, principal.userId(), folderId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/knowledge-items")
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(@PathVariable Long restaurantId,
                                                              @AuthenticationPrincipal UserPrincipal principal,
                                                              @RequestParam(required = false) Long folderId,
                                                              @RequestParam(defaultValue = "false") boolean includeInactive) {
        return knowledgeService.listKnowledgeItems(restaurantId, principal.userId(), folderId, includeInactive);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/knowledge-items")
    public TrainingKnowledgeItemDto createKnowledgeItem(@PathVariable Long restaurantId,
                                                         @AuthenticationPrincipal UserPrincipal principal,
                                                         @Valid @RequestBody CreateTrainingKnowledgeItemRequest request) {
        return knowledgeService.createKnowledgeItem(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PutMapping("/knowledge-items/{itemId}")
    public TrainingKnowledgeItemDto updateKnowledgeItem(@PathVariable Long restaurantId,
                                                         @PathVariable Long itemId,
                                                         @AuthenticationPrincipal UserPrincipal principal,
                                                         @Valid @RequestBody UpdateTrainingKnowledgeItemRequest request) {
        return knowledgeService.updateKnowledgeItem(restaurantId, principal.userId(), itemId, request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/knowledge-items/{itemId}/hide")
    public TrainingKnowledgeItemDto hideKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.hideKnowledgeItem(restaurantId, principal.userId(), itemId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/knowledge-items/{itemId}/restore")
    public TrainingKnowledgeItemDto restoreKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.restoreKnowledgeItem(restaurantId, principal.userId(), itemId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @DeleteMapping("/knowledge-items/{itemId}")
    public void deleteKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @AuthenticationPrincipal UserPrincipal principal) {
        knowledgeService.deleteKnowledgeItem(restaurantId, principal.userId(), itemId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping(value = "/knowledge-items/{itemId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TrainingKnowledgeItemDto uploadKnowledgeImage(@PathVariable Long restaurantId, @PathVariable Long itemId,
                                                         @AuthenticationPrincipal UserPrincipal principal,
                                                         @RequestParam("file") MultipartFile file) throws IOException {
        return knowledgeService.uploadKnowledgeImage(restaurantId, principal.userId(), itemId, file);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @DeleteMapping("/knowledge-items/{itemId}/image")
    public TrainingKnowledgeItemDto deleteKnowledgeImage(@PathVariable Long restaurantId, @PathVariable Long itemId,
                                                         @AuthenticationPrincipal UserPrincipal principal) throws IOException {
        return knowledgeService.deleteKnowledgeImage(restaurantId, principal.userId(), itemId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/questions")
    public List<TrainingQuestionDto> listQuestions(@PathVariable Long restaurantId,
                                                   @AuthenticationPrincipal UserPrincipal principal,
                                                   @RequestParam Long folderId,
                                                   @RequestParam(required = false) TrainingQuestionGroup questionGroup,
                                                   @RequestParam(defaultValue = "false") boolean includeInactive,
                                                   @RequestParam(required = false, name = "q") String query) {
        return questionService.listQuestions(restaurantId, principal.userId(), folderId, questionGroup, includeInactive, query);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/questions")
    public TrainingQuestionDto createQuestion(@PathVariable Long restaurantId,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody CreateTrainingQuestionRequest request) {
        return questionService.createQuestion(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PutMapping("/questions/{questionId}")
    public TrainingQuestionDto updateQuestion(@PathVariable Long restaurantId,
                                              @PathVariable Long questionId,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody UpdateTrainingQuestionRequest request) {
        return questionService.updateQuestion(restaurantId, principal.userId(), questionId, request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/questions/{questionId}/hide")
    public TrainingQuestionDto hideQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId,
                                            @AuthenticationPrincipal UserPrincipal principal) {
        return questionService.hideQuestion(restaurantId, principal.userId(), questionId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/questions/{questionId}/restore")
    public TrainingQuestionDto restoreQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId,
                                               @AuthenticationPrincipal UserPrincipal principal) {
        return questionService.restoreQuestion(restaurantId, principal.userId(), questionId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @DeleteMapping("/questions/{questionId}")
    public void deleteQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId, @AuthenticationPrincipal UserPrincipal principal) {
        questionService.deleteQuestion(restaurantId, principal.userId(), questionId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/exams")
    public List<TrainingExamDto> listExams(@PathVariable Long restaurantId,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @RequestParam(defaultValue = "false") boolean includeInactive,
                                           @RequestParam(required = false) Boolean certificationOnly) {
        boolean isManager = trainingPolicyService.canManageTraining(principal.userId(), restaurantId);
        if (includeInactive && !isManager) {
            throw new ForbiddenException("Only managers can include inactive exams");
        }
        return examService.listExams(restaurantId, principal.userId(), isManager, includeInactive, certificationOnly);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/exams/my-certifications")
    public List<CurrentUserCertificationExamDto> listCurrentUserCertifications(@PathVariable Long restaurantId,
                                                                               @AuthenticationPrincipal UserPrincipal principal) {
        return examService.listCurrentUserCertificationExams(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/exams/{examId}/my-result")
    public CertificationMyResultDto getCurrentUserCertificationResult(@PathVariable Long restaurantId,
                                                                      @PathVariable Long examId,
                                                                      @AuthenticationPrincipal UserPrincipal principal) {
        return examService.getCurrentUserCertificationResult(
                restaurantId,
                examId,
                principal.userId(),
                trainingPolicyService.canManageTraining(principal.userId(), restaurantId)
        );
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/knowledge-exams")
    public List<TrainingExamDto> listKnowledgeExams(@PathVariable Long restaurantId,
                                                    @AuthenticationPrincipal UserPrincipal principal,
                                                    @RequestParam Long folderId,
                                                    @RequestParam(defaultValue = "false") boolean includeInactive) {
        boolean isManager = trainingPolicyService.canManageTraining(principal.userId(), restaurantId);
        if (includeInactive && !isManager) {
            throw new ForbiddenException("Only managers can include inactive exams");
        }
        return examService.listPracticeExamsByKnowledgeFolder(restaurantId, principal.userId(), isManager, folderId, includeInactive);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/exams")
    public TrainingExamDto createExam(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody CreateTrainingExamRequest request) {
        return examService.createExam(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/knowledge-exams")
    public TrainingExamDto createKnowledgeExam(@PathVariable Long restaurantId,
                                               @AuthenticationPrincipal UserPrincipal principal,
                                               @Valid @RequestBody CreateTrainingExamRequest request) {
        return examService.createKnowledgeExam(restaurantId, principal.userId(), request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PutMapping("/exams/{examId}")
    public TrainingExamDto updateExam(@PathVariable Long restaurantId,
                                      @PathVariable Long examId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody UpdateTrainingExamRequest request) {
        return examService.updateExam(restaurantId, principal.userId(), examId, request);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/exams/{examId}/hide")
    public TrainingExamDto hideExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.hideExam(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PatchMapping("/exams/{examId}/restore")
    public TrainingExamDto restoreExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.restoreExam(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @DeleteMapping("/exams/{examId}")
    public void deleteExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        examService.deleteExam(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/certification/reset-cycle")
    public void resetCertificationExamCycle(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        examService.resetCertificationExamCycle(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/exams/practice-progress")
    public List<TrainingExamProgressDto> listPracticeExamProgress(@PathVariable Long restaurantId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.listCurrentUserPracticeExamProgress(restaurantId, principal.userId());
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/assignments/{userId}/reset-attempts")
    public void resetEmployeeCertificationAttempts(@PathVariable Long restaurantId,
                                                   @PathVariable Long examId,
                                                   @PathVariable Long userId,
                                                   @AuthenticationPrincipal UserPrincipal principal) {
        examService.resetEmployeeCertificationAttempts(restaurantId, principal.userId(), examId, userId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/assignments/{userId}/grant-extra-attempt")
    public void grantEmployeeCertificationExtraAttempt(@PathVariable Long restaurantId,
                                                       @PathVariable Long examId,
                                                       @PathVariable Long userId,
                                                       @AuthenticationPrincipal UserPrincipal principal,
                                                       @RequestParam(required = false) Integer amount) {
        examService.grantEmployeeCertificationExtraAttempts(restaurantId, principal.userId(), examId, userId, amount);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/exams/{examId}/certification/summary")
    public CertificationExamSummaryDto getCertificationSummary(@PathVariable Long restaurantId,
                                                               @PathVariable Long examId,
                                                               @AuthenticationPrincipal UserPrincipal principal) {
        return examService.getCertificationExamSummary(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/exams/{examId}/certification/positions")
    public List<CertificationExamPositionBreakdownDto> getCertificationPositionBreakdown(@PathVariable Long restaurantId,
                                                                                         @PathVariable Long examId,
                                                                                         @AuthenticationPrincipal UserPrincipal principal) {
        return examService.getCertificationExamPositionBreakdown(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/exams/{examId}/certification/employees")
    public List<CertificationExamEmployeeRowDto> getCertificationEmployeeTable(@PathVariable Long restaurantId,
                                                                               @PathVariable Long examId,
                                                                               @AuthenticationPrincipal UserPrincipal principal) {
        return examService.getCertificationExamEmployeeTable(restaurantId, principal.userId(), examId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/exams/{examId}/certification/employees/{userId}/attempts")
    public List<CertificationExamAttemptHistoryDto> getCertificationEmployeeAttemptHistory(@PathVariable Long restaurantId,
                                                                                           @PathVariable Long examId,
                                                                                           @PathVariable Long userId,
                                                                                           @AuthenticationPrincipal UserPrincipal principal) {
        return examService.getCertificationEmployeeAttemptHistory(restaurantId, principal.userId(), examId, userId);
    }

    @PreAuthorize("@trainingPolicyService.canManageTraining(#principal.userId, #restaurantId)")
    @GetMapping("/exams/{examId}/certification/attempts/{attemptId}")
    public CertificationAttemptDetailsDto getCertificationAttemptDetails(@PathVariable Long restaurantId,
                                                                         @PathVariable Long examId,
                                                                         @PathVariable Long attemptId,
                                                                         @AuthenticationPrincipal UserPrincipal principal) {
        return examService.getCertificationAttemptDetails(restaurantId, principal.userId(), examId, attemptId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/certification/employees")
    public List<CertificationEmployeeSummaryDto> findCertificationEmployees(@PathVariable Long restaurantId,
                                                                            @AuthenticationPrincipal UserPrincipal principal,
                                                                            @RequestParam(required = false) Long positionId,
                                                                            @RequestParam(required = false, name = "q") String query) {
        return certificationEmployeeAnalyticsService.findEmployees(restaurantId, principal.userId(), positionId, query);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/certification/employees/{userId}/exams")
    public List<CertificationEmployeeExamDto> getCertificationEmployeeExams(@PathVariable Long restaurantId,
                                                                             @PathVariable Long userId,
                                                                             @AuthenticationPrincipal UserPrincipal principal) {
        return certificationEmployeeAnalyticsService.getEmployeeExams(restaurantId, principal.userId(), userId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/start")
    public StartExamResponseDto startExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.startExam(restaurantId, examId, principal.userId(), trainingPolicyService.canManageTraining(principal.userId(), restaurantId));
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @PostMapping("/exam-attempts/{attemptId}/submit")
    public AttemptResultDto submitAttempt(@PathVariable Long restaurantId, @PathVariable Long attemptId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody SubmitAttemptRequestDto request) {
        return examService.submitAttempt(restaurantId, attemptId, principal.userId(), request);
    }

}
