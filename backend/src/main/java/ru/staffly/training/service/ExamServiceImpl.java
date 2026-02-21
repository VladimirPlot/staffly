package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;

import java.util.*;

@Service
@RequiredArgsConstructor
public class ExamServiceImpl implements ExamService {
    private final TrainingExamRepository exams;
    private final TrainingExamScopeRepository scopes;
    private final TrainingQuestionRepository questions;
    private final TrainingExamAttemptRepository attempts;
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final TrainingFolderRepository folders;

    @Override
    public List<TrainingExamDto> listExams(Long restaurantId) {
        return exams.findByRestaurantIdOrderByCreatedAtDesc(restaurantId).stream().map(this::toDto).toList();
    }

    @Override
    @Transactional
    public TrainingExamDto createExam(Long restaurantId, TrainingExamDto dto) {
        var exam = exams.save(TrainingExam.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .title(dto.title())
                .description(dto.description())
                .questionCount(dto.questionCount())
                .passPercent(dto.passPercent())
                .timeLimitSec(dto.timeLimitSec())
                .active(dto.active() == null || dto.active())
                .build());
        replaceScopes(restaurantId, exam, dto.folderIds());
        return toDto(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto updateExam(Long restaurantId, Long examId, TrainingExamDto dto) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId).orElseThrow(() -> new NotFoundException("Exam not found"));
        exam.setTitle(dto.title());
        exam.setDescription(dto.description());
        exam.setQuestionCount(dto.questionCount());
        exam.setPassPercent(dto.passPercent());
        exam.setTimeLimitSec(dto.timeLimitSec());
        exam.setActive(dto.active() == null ? exam.isActive() : dto.active());
        replaceScopes(restaurantId, exam, dto.folderIds());
        return toDto(exam);
    }

    @Override
    @Transactional
    public void deleteExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId).orElseThrow(() -> new NotFoundException("Exam not found"));
        scopes.deleteByExamId(examId);
        exams.delete(exam);
    }

    @Override
    @Transactional
    public TrainingExamAttemptDto startExam(Long restaurantId, Long examId, Long userId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId).orElseThrow(() -> new NotFoundException("Exam not found"));
        var scopeIds = scopes.findByExamId(examId).stream().map(x -> x.getFolder().getId()).toList();
        var pool = scopeIds.isEmpty() ? List.<TrainingQuestion>of() : questions.findByRestaurantIdAndFolderIdInAndActiveTrue(restaurantId, scopeIds);
        if (pool.isEmpty()) throw new BadRequestException("No questions in exam scope");
        Collections.shuffle(pool);
        int count = Math.min(exam.getQuestionCount(), pool.size());
        var selected = pool.subList(0, count);

        var attempt = attempts.save(TrainingExamAttempt.builder()
                .exam(exam)
                .user(User.builder().id(userId).build())
                .startedAt(TimeProvider.now())
                .build());

        attemptQuestions.saveAll(selected.stream().map(q -> TrainingExamAttemptQuestion.builder()
                .attempt(attempt).question(q).correct(false).build()).toList());

        return toAttemptDto(attempt);
    }

    @Override
    @Transactional
    public TrainingExamAttemptDto submitAttempt(Long restaurantId, Long attemptId, Long userId, TrainingExamSubmitRequest request) {
        var attempt = attempts.findByIdAndExamRestaurantId(attemptId, restaurantId).orElseThrow(() -> new NotFoundException("Attempt not found"));
        if (!Objects.equals(attempt.getUser().getId(), userId)) throw new BadRequestException("Attempt belongs to another user");
        var existing = attemptQuestions.findByAttemptId(attemptId);
        var byQuestionId = new HashMap<Long, TrainingExamAttemptQuestionDto>();
        request.questions().forEach(x -> byQuestionId.put(x.questionId(), x));
        int correct = 0;
        for (var item : existing) {
            var answer = byQuestionId.get(item.getQuestion().getId());
            item.setChosenAnswerJson(answer == null ? null : answer.chosenAnswerJson());
            boolean isCorrect = answer != null && Boolean.TRUE.equals(answer.correct());
            item.setCorrect(isCorrect);
            if (isCorrect) correct++;
        }
        int score = existing.isEmpty() ? 0 : (int) Math.round((correct * 100.0) / existing.size());
        attempt.setFinishedAt(TimeProvider.now());
        attempt.setScorePercent(score);
        attempt.setPassed(score >= attempt.getExam().getPassPercent());
        return toAttemptDto(attempt);
    }

    private void replaceScopes(Long restaurantId, TrainingExam exam, List<Long> folderIds) {
        scopes.deleteByExamId(exam.getId());
        if (folderIds == null || folderIds.isEmpty()) return;
        List<TrainingExamScope> entities = new ArrayList<>();
        for (Long folderId : folderIds) {
            var folder = folders.findByIdAndRestaurantId(folderId, restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Exam scope accepts only QUESTION_BANK folders");
            entities.add(TrainingExamScope.builder().exam(exam).folder(folder).build());
        }
        scopes.saveAll(entities);
    }

    private TrainingExamDto toDto(TrainingExam exam) {
        return new TrainingExamDto(exam.getId(), exam.getRestaurant().getId(), exam.getTitle(), exam.getDescription(), exam.getQuestionCount(),
                exam.getPassPercent(), exam.getTimeLimitSec(), exam.isActive(), scopes.findByExamId(exam.getId()).stream().map(x -> x.getFolder().getId()).toList());
    }

    private TrainingExamAttemptDto toAttemptDto(TrainingExamAttempt attempt) {
        return new TrainingExamAttemptDto(attempt.getId(), attempt.getExam().getId(), attempt.getUser().getId(), attempt.getStartedAt(),
                attempt.getFinishedAt(), attempt.getScorePercent(), attempt.getPassed(),
                attemptQuestions.findByAttemptId(attempt.getId()).stream().map(x -> new TrainingExamAttemptQuestionDto(x.getId(), x.getQuestion().getId(), x.getChosenAnswerJson(), x.isCorrect())).toList());
    }
}
