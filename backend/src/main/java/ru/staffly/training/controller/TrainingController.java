package ru.staffly.training.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.http.MediaType;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.web.multipart.MultipartFile;
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

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/folders")
    public List<TrainingFolderDto> listFolders(@PathVariable Long restaurantId, @RequestParam TrainingFolderType type) {
        return knowledgeService.listFolders(restaurantId, type);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/folders")
    public TrainingFolderDto createFolder(@PathVariable Long restaurantId, @Valid @RequestBody TrainingFolderDto dto) {
        return knowledgeService.createFolder(restaurantId, new TrainingFolderDto(dto.id(), restaurantId, dto.parentId(), dto.name(), dto.description(), dto.type(), dto.sortOrder(), dto.active()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/folders/{folderId}")
    public TrainingFolderDto updateFolder(@PathVariable Long restaurantId, @PathVariable Long folderId, @Valid @RequestBody TrainingFolderDto dto) {
        return knowledgeService.updateFolder(restaurantId, folderId, new TrainingFolderDto(dto.id(), restaurantId, dto.parentId(), dto.name(), dto.description(), dto.type(), dto.sortOrder(), dto.active()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/folders/{folderId}")
    public void deleteFolder(@PathVariable Long restaurantId, @PathVariable Long folderId) {
        knowledgeService.deleteFolder(restaurantId, folderId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/knowledge-items")
    public List<TrainingKnowledgeItemDto> listKnowledgeItems(@PathVariable Long restaurantId, @RequestParam Long folderId) {
        return knowledgeService.listKnowledgeItems(restaurantId, folderId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/knowledge-items")
    public TrainingKnowledgeItemDto createKnowledgeItem(@PathVariable Long restaurantId, @Valid @RequestBody TrainingKnowledgeItemDto dto) {
        return knowledgeService.createKnowledgeItem(restaurantId, new TrainingKnowledgeItemDto(dto.id(), restaurantId, dto.folderId(), dto.title(), dto.description(), dto.composition(), dto.allergens(), dto.imageUrl(), dto.sortOrder(), dto.active()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/knowledge-items/{itemId}")
    public TrainingKnowledgeItemDto updateKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId, @Valid @RequestBody TrainingKnowledgeItemDto dto) {
        return knowledgeService.updateKnowledgeItem(restaurantId, itemId, new TrainingKnowledgeItemDto(dto.id(), restaurantId, dto.folderId(), dto.title(), dto.description(), dto.composition(), dto.allergens(), dto.imageUrl(), dto.sortOrder(), dto.active()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/knowledge-items/{itemId}")
    public void deleteKnowledgeItem(@PathVariable Long restaurantId, @PathVariable Long itemId) {
        knowledgeService.deleteKnowledgeItem(restaurantId, itemId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping(value = "/knowledge-items/{itemId}/image", consumes = MediaType.MULTIPART_FORM_DATA_VALUE)
    public TrainingKnowledgeItemDto uploadKnowledgeImage(@PathVariable Long restaurantId, @PathVariable Long itemId, @RequestParam("file") MultipartFile file) throws IOException {
        return knowledgeService.uploadKnowledgeImage(restaurantId, itemId, file);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/knowledge-items/{itemId}/image")
    public TrainingKnowledgeItemDto deleteKnowledgeImage(@PathVariable Long restaurantId, @PathVariable Long itemId) throws IOException {
        return knowledgeService.deleteKnowledgeImage(restaurantId, itemId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/questions")
    public List<TrainingQuestionDto> listQuestions(@PathVariable Long restaurantId, @RequestParam Long folderId) {
        return questionService.listQuestions(restaurantId, folderId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/questions")
    public TrainingQuestionDto createQuestion(@PathVariable Long restaurantId, @Valid @RequestBody TrainingQuestionDto dto) {
        return questionService.createQuestion(restaurantId, new TrainingQuestionDto(dto.id(), restaurantId, dto.folderId(), dto.type(), dto.prompt(), dto.explanation(), dto.sortOrder(), dto.active(), dto.options(), dto.matchPairs()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/questions/{questionId}")
    public TrainingQuestionDto updateQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId, @Valid @RequestBody TrainingQuestionDto dto) {
        return questionService.updateQuestion(restaurantId, questionId, new TrainingQuestionDto(dto.id(), restaurantId, dto.folderId(), dto.type(), dto.prompt(), dto.explanation(), dto.sortOrder(), dto.active(), dto.options(), dto.matchPairs()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/questions/{questionId}")
    public void deleteQuestion(@PathVariable Long restaurantId, @PathVariable Long questionId) {
        questionService.deleteQuestion(restaurantId, questionId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/exams")
    public List<TrainingExamDto> listExams(@PathVariable Long restaurantId) {
        return examService.listExams(restaurantId);
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/exams")
    public TrainingExamDto createExam(@PathVariable Long restaurantId, @Valid @RequestBody TrainingExamDto dto) {
        return examService.createExam(restaurantId, new TrainingExamDto(dto.id(), restaurantId, dto.title(), dto.description(), dto.questionCount(), dto.passPercent(), dto.timeLimitSec(), dto.active(), dto.folderIds()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PutMapping("/exams/{examId}")
    public TrainingExamDto updateExam(@PathVariable Long restaurantId, @PathVariable Long examId, @Valid @RequestBody TrainingExamDto dto) {
        return examService.updateExam(restaurantId, examId, new TrainingExamDto(dto.id(), restaurantId, dto.title(), dto.description(), dto.questionCount(), dto.passPercent(), dto.timeLimitSec(), dto.active(), dto.folderIds()));
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/exams/{examId}")
    public void deleteExam(@PathVariable Long restaurantId, @PathVariable Long examId) {
        examService.deleteExam(restaurantId, examId);
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/exams/{examId}/start")
    public TrainingExamAttemptDto startExam(@PathVariable Long restaurantId, @PathVariable Long examId, @AuthenticationPrincipal UserPrincipal principal) {
        return examService.startExam(restaurantId, examId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/exam-attempts/{attemptId}/submit")
    public TrainingExamAttemptDto submitAttempt(@PathVariable Long restaurantId, @PathVariable Long attemptId,
                                                @AuthenticationPrincipal UserPrincipal principal,
                                                @Valid @RequestBody TrainingExamSubmitRequest request) {
        return examService.submitAttempt(restaurantId, attemptId, principal.userId(), request);
    }
}
