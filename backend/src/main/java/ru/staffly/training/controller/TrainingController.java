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
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.service.ExamService;
import ru.staffly.training.service.KnowledgeService;
import ru.staffly.training.service.QuestionService;

import java.io.IOException;
import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}/training")
@RequiredArgsConstructor
public class TrainingController {
    private final KnowledgeService knowledgeService;
    private final QuestionService questionService;
    private final ExamService examService;
    private final SecurityService securityService;

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/folders")
    public List<TrainingFolderDto> listFolders(@PathVariable Long restaurantId,
                                               @AuthenticationPrincipal UserPrincipal principal,
                                               @RequestParam TrainingFolderType type,
                                               @RequestParam(defaultValue = "false") boolean includeInactive) {
        if (type == TrainingFolderType.QUESTION_BANK && !securityService.hasAtLeastManager(principal.userId(), restaurantId)) {
            throw new ForbiddenException("Only managers can access question bank");
        }
        return knowledgeService.listFolders(restaurantId, principal.userId(), type, includeInactive);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PostMapping("/folders")
    public TrainingFolderDto createFolder(@PathVariable Long restaurantId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody CreateTrainingFolderRequest request) {
        return knowledgeService.createFolder(restaurantId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PutMapping("/folders/{folderId}")
    public TrainingFolderDto updateFolder(@PathVariable Long restaurantId,
                                          @PathVariable Long folderId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody UpdateTrainingFolderRequest request) {
        return knowledgeService.updateFolder(restaurantId, folderId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/folders/{folderId}/hide")
    public TrainingFolderDto hideFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.hideFolder(restaurantId, folderId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/folders/{folderId}/restore")
    public TrainingFolderDto restoreFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.restoreFolder(restaurantId, folderId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @DeleteMapping("/folders/{folderId}")
    public void deleteFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @AuthenticationPrincipal UserPrincipal principal) {
        knowledgeService.deleteFolder(restaurantId, folderId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/knowledge-items")
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(@PathVariable Long restaurantId,
                                                              @AuthenticationPrincipal UserPrincipal principal,
                                                              @RequestParam Long folderId,
                                                              @RequestParam(defaultValue = "false") boolean includeInactive) {
        return knowledgeService.listKnowledgeItems(restaurantId, principal.userId(), folderId, includeInactive);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PostMapping("/knowledge-items")
    public TrainingKnowledgeItemDto createKnowledgeItem(@PathVariable Long restaurantId,
                                                         @AuthenticationPrincipal UserPrincipal principal,
                                                         @Valid @RequestBody CreateTrainingKnowledgeItemRequest request) {
        return knowledgeService.createKnowledgeItem(restaurantId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PutMapping("/knowledge-items/{itemId}")
    public TrainingKnowledgeItemDto updateKnowledgeItem(@PathVariable Long restaurantId,
                                                         @PathVariable Long itemId,
                                                         @AuthenticationPrincipal UserPrincipal principal,
                                                         @Valid @RequestBody UpdateTrainingKnowledgeItemRequest request) {
        return knowledgeService.updateKnowledgeItem(restaurantId, itemId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/knowledge-items/{itemId}/hide")
    public TrainingKnowledgeItemDto hideKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.hideKnowledgeItem(restaurantId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/knowledge-items/{itemId}/restore")
    public TrainingKnowledgeItemDto restoreKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @AuthenticationPrincipal UserPrincipal principal) {
        return knowledgeService.restoreKnowledgeItem(restaurantId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @DeleteMapping("/knowledge-items/{itemId}")
    public void deleteKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @AuthenticationPrincipal UserPrincipal principal) {
        knowledgeService.deleteKnowledgeItem(restaurantId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PostMapping(value = "/knowledge-items/{itemId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TrainingKnowledgeItemDto uploadKnowledgeImage(@PathVariable Long restaurantId, @PathVariable Long itemId,
                                                         @AuthenticationPrincipal UserPrincipal principal,
                                                         @RequestParam("file") MultipartFile file) throws IOException {
        return knowledgeService.uploadKnowledgeImage(restaurantId, itemId, file);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @DeleteMapping("/knowledge-items/{itemId}/image")
    public TrainingKnowledgeItemDto deleteKnowledgeImage(@PathVariable Long restaurantId, @PathVariable Long itemId,
                                                         @AuthenticationPrincipal UserPrincipal principal) throws IOException {
        return knowledgeService.deleteKnowledgeImage(restaurantId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @GetMapping("/questions")
    public List<TrainingQuestionDto> listQuestions(@PathVariable Long restaurantId,
                                                   @AuthenticationPrincipal UserPrincipal principal,
                                                   @RequestParam Long folderId,
                                                   @RequestParam(defaultValue = "false") boolean includeInactive) {
        return questionService.listQuestions(restaurantId, folderId, includeInactive);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PostMapping("/questions")
    public TrainingQuestionDto createQuestion(@PathVariable Long restaurantId,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody CreateTrainingQuestionRequest request) {
        return questionService.createQuestion(restaurantId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PutMapping("/questions/{questionId}")
    public TrainingQuestionDto updateQuestion(@PathVariable Long restaurantId,
                                              @PathVariable Long questionId,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody UpdateTrainingQuestionRequest request) {
        return questionService.updateQuestion(restaurantId, questionId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/questions/{questionId}/hide")
    public TrainingQuestionDto hideQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId,
                                            @AuthenticationPrincipal UserPrincipal principal) {
        return questionService.hideQuestion(restaurantId, questionId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/questions/{questionId}/restore")
    public TrainingQuestionDto restoreQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId,
                                               @AuthenticationPrincipal UserPrincipal principal) {
        return questionService.restoreQuestion(restaurantId, questionId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @DeleteMapping("/questions/{questionId}")
    public void deleteQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId, @AuthenticationPrincipal UserPrincipal principal) {
        questionService.deleteQuestion(restaurantId, questionId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/exams")
    public List<TrainingExamDto> listExams(@PathVariable Long restaurantId,
                                           @AuthenticationPrincipal UserPrincipal principal,
                                           @RequestParam(defaultValue = "false") boolean includeInactive) {
        if (includeInactive && !securityService.hasAtLeastManager(principal.userId(), restaurantId)) {
            throw new ForbiddenException("Only managers can include inactive exams");
        }
        return examService.listExams(restaurantId, includeInactive);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PostMapping("/exams")
    public TrainingExamDto createExam(@PathVariable Long restaurantId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody CreateTrainingExamRequest request) {
        return examService.createExam(restaurantId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PutMapping("/exams/{examId}")
    public TrainingExamDto updateExam(@PathVariable Long restaurantId,
                                      @PathVariable Long examId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody UpdateTrainingExamRequest request) {
        return examService.updateExam(restaurantId, examId, request);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/exams/{examId}/hide")
    public TrainingExamDto hideExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.hideExam(restaurantId, examId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PatchMapping("/exams/{examId}/restore")
    public TrainingExamDto restoreExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.restoreExam(restaurantId, examId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @DeleteMapping("/exams/{examId}")
    public void deleteExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        examService.deleteExam(restaurantId, examId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(#principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/reset-results")
    public void resetExamResults(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        examService.resetExamResults(restaurantId, examId);
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @GetMapping("/exams/progress")
    public List<TrainingExamProgressDto> listExamProgress(@PathVariable Long restaurantId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.listCurrentUserExamProgress(restaurantId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/start")
    public StartExamResponseDto startExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.startExam(restaurantId, examId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(#principal.userId, #restaurantId)")
    @PostMapping("/exam-attempts/{attemptId}/submit")
    public AttemptResultDto submitAttempt(@PathVariable Long restaurantId, @PathVariable Long attemptId,
                                          @AuthenticationPrincipal UserPrincipal principal,
                                          @Valid @RequestBody SubmitAttemptRequestDto request) {
        return examService.submitAttempt(restaurantId, attemptId, principal.userId(), request);
    }
}
