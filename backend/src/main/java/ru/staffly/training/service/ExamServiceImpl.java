package ru.staffly.training.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ExamServiceImpl implements ExamService {
    private final TrainingExamRepository exams;
    private final TrainingExamScopeRepository scopes;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository questionOptions;
    private final TrainingQuestionMatchPairRepository questionPairs;
    private final TrainingExamAttemptRepository attempts;
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final TrainingFolderRepository folders;
    private final ObjectMapper objectMapper;

    @Override
    public List<TrainingExamDto> listExams(Long restaurantId, boolean includeInactive) {
        var examList = includeInactive
                ? exams.findByRestaurantIdOrderByCreatedAtDesc(restaurantId)
                : exams.findByRestaurantIdAndActiveTrueOrderByCreatedAtDesc(restaurantId);
        if (examList.isEmpty()) return List.of();
        var examIds = examList.stream().map(TrainingExam::getId).toList();
        var scopesByExam = scopes.findByExamIdIn(examIds).stream()
                .collect(Collectors.groupingBy(s -> s.getExam().getId(), Collectors.mapping(s -> s.getFolder().getId(), Collectors.toList())));
        return examList.stream().map(exam -> new TrainingExamDto(exam.getId(), exam.getRestaurant().getId(), exam.getTitle(), exam.getDescription(), exam.getQuestionCount(),
                exam.getPassPercent(), exam.getTimeLimitSec(), exam.isActive(), scopesByExam.getOrDefault(exam.getId(), List.of()))).toList();
    }

    @Override
    @Transactional
    public TrainingExamDto createExam(Long restaurantId, CreateTrainingExamRequest request) {
        var exam = exams.save(TrainingExam.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .title(request.title())
                .description(request.description())
                .questionCount(request.questionCount())
                .passPercent(request.passPercent())
                .timeLimitSec(request.timeLimitSec())
                .active(true)
                .build());
        replaceScopes(restaurantId, exam, request.folderIds());
        return listExams(restaurantId, true).stream().filter(x -> x.id().equals(exam.getId())).findFirst().orElseThrow();
    }

    @Override
    @Transactional
    public TrainingExamDto updateExam(Long restaurantId, Long examId, UpdateTrainingExamRequest request) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId).orElseThrow(() -> new NotFoundException("Exam not found"));
        exam.setTitle(request.title());
        exam.setDescription(request.description());
        exam.setQuestionCount(request.questionCount());
        exam.setPassPercent(request.passPercent());
        exam.setTimeLimitSec(request.timeLimitSec());
        exam.setActive(request.active() == null ? exam.isActive() : request.active());
        replaceScopes(restaurantId, exam, request.folderIds());
        return listExams(restaurantId, true).stream().filter(x -> x.id().equals(exam.getId())).findFirst().orElseThrow();
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
    public StartExamResponseDto startExam(Long restaurantId, Long examId, Long userId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId).orElseThrow(() -> new NotFoundException("Exam not found"));
        var scopeIds = scopes.findByExamId(examId).stream().map(x -> x.getFolder().getId()).toList();
        var pool = scopeIds.isEmpty() ? List.<TrainingQuestion>of() : questions.findByRestaurantIdAndFolderIdInAndActiveTrue(restaurantId, scopeIds);
        if (pool.isEmpty()) throw new BadRequestException("No questions in exam scope");

        var questionIds = pool.stream().map(TrainingQuestion::getId).toList();
        var optionsByQuestion = questionOptions.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId()));
        var pairsByQuestion = questionPairs.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(p -> p.getQuestion().getId()));

        Collections.shuffle(pool);
        int count = Math.min(exam.getQuestionCount(), pool.size());
        var selected = pool.subList(0, count);

        var attempt = attempts.save(TrainingExamAttempt.builder()
                .exam(exam)
                .user(User.builder().id(userId).build())
                .startedAt(TimeProvider.now())
                .build());

        List<TrainingExamAttemptQuestion> entities = new ArrayList<>();
        List<AttemptQuestionSnapshotDto> snapshots = new ArrayList<>();
        for (var question : selected) {
            var snapshot = buildSnapshot(question, optionsByQuestion.getOrDefault(question.getId(), List.of()), pairsByQuestion.getOrDefault(question.getId(), List.of()));
            snapshots.add(snapshot.snapshotDto());
            entities.add(TrainingExamAttemptQuestion.builder()
                    .attempt(attempt)
                    .question(question)
                    .questionSnapshotJson(snapshot.snapshotJson())
                    .correctKeyJson(snapshot.correctKeyJson())
                    .correct(false)
                    .build());
        }
        attemptQuestions.saveAll(entities);

        var examDto = new TrainingExamDto(exam.getId(), restaurantId, exam.getTitle(), exam.getDescription(), exam.getQuestionCount(), exam.getPassPercent(), exam.getTimeLimitSec(), exam.isActive(), scopeIds);
        return new StartExamResponseDto(attempt.getId(), attempt.getStartedAt(), examDto, snapshots);
    }

    @Override
    @Transactional
    public AttemptResultDto submitAttempt(Long restaurantId, Long attemptId, Long userId, SubmitAttemptRequestDto request) {
        var attempt = attempts.findByIdAndExamRestaurantId(attemptId, restaurantId).orElseThrow(() -> new NotFoundException("Attempt not found"));
        if (!Objects.equals(attempt.getUser().getId(), userId)) throw new BadRequestException("Attempt belongs to another user");
        if (attempt.getFinishedAt() != null) throw new ConflictException("Attempt already finished");

        var existing = attemptQuestions.findByAttemptId(attemptId);
        var byQuestionId = request.answers().stream().collect(Collectors.toMap(SubmitAttemptAnswerDto::questionId, Function.identity(), (a, b) -> b));
        int correctAnswers = 0;

        for (var item : existing) {
            var answer = byQuestionId.get(item.getQuestion().getId());
            if (answer == null) throw new BadRequestException("Missing answer for question " + item.getQuestion().getId());
            validateAnswerForType(answer.answerJson(), item.getQuestionSnapshotJson());
            item.setChosenAnswerJson(answer.answerJson());
            boolean isCorrect = isAnswerCorrect(answer.answerJson(), item.getCorrectKeyJson());
            item.setCorrect(isCorrect);
            if (isCorrect) correctAnswers++;
        }

        int score = existing.isEmpty() ? 0 : (int) Math.round((correctAnswers * 100.0) / existing.size());
        attempt.setFinishedAt(TimeProvider.now());
        attempt.setScorePercent(score);
        attempt.setPassed(score >= attempt.getExam().getPassPercent());

        return new AttemptResultDto(attempt.getId(), attempt.getExam().getId(), attempt.getUser().getId(), attempt.getStartedAt(), attempt.getFinishedAt(), attempt.getScorePercent(), attempt.getPassed(),
                existing.stream().map(x -> new AttemptResultQuestionDto(x.getQuestion().getId(), x.getChosenAnswerJson(), x.isCorrect())).toList());
    }

    private SnapshotPayload buildSnapshot(TrainingQuestion question, List<TrainingQuestionOption> options, List<TrainingQuestionMatchPair> pairs) {
        try {
            var optionView = options.stream().map(o -> new TrainingQuestionOptionViewDto(o.getSortOrder(), o.getText())).toList();
            var pairView = pairs.stream().map(p -> new TrainingQuestionMatchPairViewDto(p.getSortOrder(), p.getLeftText(), p.getRightText())).toList();
            var snapshotDto = new AttemptQuestionSnapshotDto(question.getId(), question.getType(), question.getPrompt(), question.getExplanation(), optionView, pairView);
            String snapshotJson = objectMapper.writeValueAsString(snapshotDto);
            String correctKey = switch (question.getType()) {
                case MATCH -> objectMapper.writeValueAsString(pairs.stream().map(TrainingQuestionMatchPair::getRightText).toList());
                case MULTI -> objectMapper.writeValueAsString(options.stream().filter(TrainingQuestionOption::isCorrect).map(TrainingQuestionOption::getText).sorted().toList());
                default -> objectMapper.writeValueAsString(options.stream().filter(TrainingQuestionOption::isCorrect).map(TrainingQuestionOption::getText).findFirst().orElse(""));
            };
            return new SnapshotPayload(snapshotDto, snapshotJson, correctKey);
        } catch (Exception e) {
            throw new BadRequestException("Cannot serialize exam snapshot");
        }
    }

    private void validateAnswerForType(String answerJson, String snapshotJson) {
        try {
            var snapshot = objectMapper.readValue(snapshotJson, AttemptQuestionSnapshotDto.class);
            switch (snapshot.type()) {
                case MATCH, MULTI -> objectMapper.readValue(answerJson, new TypeReference<List<String>>() {});
                default -> objectMapper.readValue(answerJson, String.class);
            }
        } catch (Exception e) {
            throw new BadRequestException("Invalid answer format");
        }
    }

    private boolean isAnswerCorrect(String answerJson, String correctKeyJson) {
        try {
            if (correctKeyJson.startsWith("[")) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {}).stream().sorted().toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<String>>() {}).stream().sorted().toList();
                return expected.equals(actual);
            }
            String actual = objectMapper.readValue(answerJson, String.class);
            String expected = objectMapper.readValue(correctKeyJson, String.class);
            return Objects.equals(expected, actual);
        } catch (Exception e) {
            throw new BadRequestException("Invalid answer payload");
        }
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

    private record SnapshotPayload(AttemptQuestionSnapshotDto snapshotDto, String snapshotJson, String correctKeyJson) {}
}
