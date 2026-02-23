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
                .collect(Collectors.groupingBy(
                        s -> s.getExam().getId(),
                        Collectors.mapping(s -> s.getFolder().getId(), Collectors.toList())
                ));

        return examList.stream()
                .map(exam -> toDto(exam, scopesByExam.getOrDefault(exam.getId(), List.of())))
                .toList();
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
                .version(1)
                .build());

        replaceScopes(restaurantId, exam, request.folderIds());
        return toDtoWithScopes(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto updateExam(Long restaurantId, Long examId, UpdateTrainingExamRequest request) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        exam.setTitle(request.title());
        exam.setDescription(request.description());
        exam.setQuestionCount(request.questionCount());
        exam.setPassPercent(request.passPercent());
        exam.setTimeLimitSec(request.timeLimitSec());
        exam.setActive(request.active() == null ? exam.isActive() : request.active());

        replaceScopes(restaurantId, exam, request.folderIds());
        return toDtoWithScopes(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto hideExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        exam.setActive(false);
        return toDtoWithScopes(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto restoreExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        exam.setActive(true);
        return toDtoWithScopes(exam);
    }

    @Override
    @Transactional
    public void deleteExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        if (exam.isActive()) {
            throw new ConflictException("Сначала скройте экзамен, затем удаляйте.");
        }
        exams.delete(exam);
    }

    @Override
    @Transactional
    public void resetExamResults(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        exam.setVersion(exam.getVersion() + 1);
    }

    @Override
    public List<TrainingExamProgressDto> listCurrentUserExamProgress(Long restaurantId, Long userId) {
        var examIds = exams.findByRestaurantIdOrderByCreatedAtDesc(restaurantId)
                .stream()
                .map(TrainingExam::getId)
                .toList();

        if (examIds.isEmpty()) return List.of();

        var progressByExamId = attempts
                .findCurrentPassedProgressByRestaurantAndUserAndExamIds(restaurantId, userId, examIds)
                .stream()
                .collect(Collectors.toMap(
                        TrainingExamProgressProjection::getExamId,
                        Function.identity(),
                        (a, b) -> a // safety merge (should not happen with the fixed SQL)
                ));

        return examIds.stream()
                .map(examId -> {
                    var progress = progressByExamId.get(examId);
                    return new TrainingExamProgressDto(
                            examId,
                            progress != null,
                            progress == null ? null : progress.getLastAttemptAt(),
                            progress == null ? null : progress.getScorePercent()
                    );
                })
                .toList();
    }

    @Override
    @Transactional
    public StartExamResponseDto startExam(Long restaurantId, Long examId, Long userId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        if (!exam.isActive()) {
            throw new ConflictException("Экзамен скрыт. Нельзя начать прохождение.");
        }

        var scopeIds = scopes.findByExamId(examId).stream().map(x -> x.getFolder().getId()).toList();
        var pool = scopeIds.isEmpty()
                ? List.<TrainingQuestion>of()
                : questions.findByRestaurantIdAndFolderIdInAndActiveTrue(restaurantId, scopeIds);

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
                .examVersion(exam.getVersion())
                .restaurant(exam.getRestaurant())
                .user(User.builder().id(userId).build())
                .startedAt(TimeProvider.now())
                .passPercentSnapshot(exam.getPassPercent())
                .titleSnapshot(exam.getTitle())
                .questionCountSnapshot(exam.getQuestionCount())
                .timeLimitSecSnapshot(exam.getTimeLimitSec())
                .build());

        List<TrainingExamAttemptQuestion> entities = new ArrayList<>();
        List<AttemptQuestionSnapshotDto> snapshots = new ArrayList<>();

        for (var question : selected) {
            var snapshot = buildSnapshot(
                    question,
                    optionsByQuestion.getOrDefault(question.getId(), List.of()),
                    pairsByQuestion.getOrDefault(question.getId(), List.of())
            );
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

        return new StartExamResponseDto(
                attempt.getId(),
                attempt.getStartedAt(),
                attempt.getExamVersion(),
                toDto(exam, scopeIds),
                snapshots
        );
    }

    @Override
    @Transactional
    public AttemptResultDto submitAttempt(Long restaurantId, Long attemptId, Long userId, SubmitAttemptRequestDto request) {
        var attempt = attempts.findByIdAndRestaurantId(attemptId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Attempt not found"));

        if (!Objects.equals(attempt.getUser().getId(), userId)) throw new BadRequestException("Attempt belongs to another user");
        if (attempt.getFinishedAt() != null) throw new ConflictException("Attempt already finished");

        var existing = attemptQuestions.findByAttemptId(attemptId);
        var byQuestionId = request.answers().stream()
                .collect(Collectors.toMap(SubmitAttemptAnswerDto::questionId, Function.identity(), (a, b) -> b));

        int correctAnswers = 0;

        for (var item : existing) {
            var snapshot = readSnapshot(item.getQuestionSnapshotJson());
            var answer = byQuestionId.get(snapshot.questionId());
            if (answer == null) throw new BadRequestException("Missing answer for question " + snapshot.questionId());

            validateAnswerForType(answer.answerJson(), snapshot);

            item.setChosenAnswerJson(answer.answerJson());
            boolean isCorrect = isAnswerCorrect(answer.answerJson(), item.getCorrectKeyJson(), snapshot.type());
            item.setCorrect(isCorrect);
            if (isCorrect) correctAnswers++;
        }

        int score = existing.isEmpty() ? 0 : (int) Math.round((correctAnswers * 100.0) / existing.size());
        attempt.setFinishedAt(TimeProvider.now());
        attempt.setScorePercent(score);
        attempt.setPassed(score >= attempt.getPassPercentSnapshot());

        return new AttemptResultDto(
                attempt.getId(),
                attempt.getExam() == null ? null : attempt.getExam().getId(),
                attempt.getExamVersion(),
                attempt.getUser().getId(),
                attempt.getStartedAt(),
                attempt.getFinishedAt(),
                attempt.getScorePercent(),
                attempt.getPassed(),
                existing.stream()
                        .map(x -> new AttemptResultQuestionDto(
                                readSnapshot(x.getQuestionSnapshotJson()).questionId(),
                                x.getChosenAnswerJson(),
                                x.isCorrect()
                        ))
                        .toList()
        );
    }

    private SnapshotPayload buildSnapshot(TrainingQuestion question, List<TrainingQuestionOption> options, List<TrainingQuestionMatchPair> pairs) {
        try {
            var optionView = options.stream().map(o -> new TrainingQuestionOptionViewDto(o.getSortOrder(), o.getText())).toList();
            var pairView = pairs.stream().map(p -> new TrainingQuestionMatchPairViewDto(p.getSortOrder(), p.getLeftText(), p.getRightText())).toList();

            var snapshotDto = new AttemptQuestionSnapshotDto(
                    question.getId(),
                    question.getType(),
                    question.getPrompt(),
                    question.getExplanation(),
                    optionView,
                    pairView
            );

            String snapshotJson = objectMapper.writeValueAsString(snapshotDto);

            String correctKey = switch (question.getType()) {
                case MATCH -> objectMapper.writeValueAsString(
                        pairs.stream()
                                .map(p -> new MatchPairAnswer(p.getLeftText(), p.getRightText()))
                                .sorted(Comparator.comparing(MatchPairAnswer::left))
                                .toList()
                );
                case MULTI -> objectMapper.writeValueAsString(
                        options.stream()
                                .filter(TrainingQuestionOption::isCorrect)
                                .map(TrainingQuestionOption::getText)
                                .sorted()
                                .toList()
                );
                default -> objectMapper.writeValueAsString(
                        options.stream()
                                .filter(TrainingQuestionOption::isCorrect)
                                .map(TrainingQuestionOption::getText)
                                .findFirst()
                                .orElse("")
                );
            };

            return new SnapshotPayload(snapshotDto, snapshotJson, correctKey);
        } catch (Exception e) {
            throw new BadRequestException("Cannot serialize exam snapshot");
        }
    }

    private AttemptQuestionSnapshotDto readSnapshot(String snapshotJson) {
        try {
            return objectMapper.readValue(snapshotJson, AttemptQuestionSnapshotDto.class);
        } catch (Exception e) {
            throw new BadRequestException("Invalid question snapshot");
        }
    }

    private void validateAnswerForType(String answerJson, AttemptQuestionSnapshotDto snapshot) {
        try {
            switch (snapshot.type()) {
                case MATCH -> {
                    var answerPairs = objectMapper.readValue(answerJson, new TypeReference<List<MatchPairAnswer>>() {});
                    var allowedLeft = snapshot.matchPairs().stream().map(TrainingQuestionMatchPairViewDto::leftText).collect(Collectors.toSet());
                    var allowedRight = snapshot.matchPairs().stream().map(TrainingQuestionMatchPairViewDto::rightText).collect(Collectors.toSet());

                    if (answerPairs.size() != allowedLeft.size()) throw new BadRequestException("Invalid answer values");

                    var lefts = new HashSet<String>();
                    var rights = new HashSet<String>();
                    for (var pair : answerPairs) {
                        if (!allowedLeft.contains(pair.left())
                                || !allowedRight.contains(pair.right())
                                || !lefts.add(pair.left())
                                || !rights.add(pair.right())) {
                            throw new BadRequestException("Invalid answer values");
                        }
                    }
                }
                case MULTI -> {
                    var values = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {});
                    var allowed = snapshot.options().stream().map(TrainingQuestionOptionViewDto::text).collect(Collectors.toSet());
                    if (!allowed.containsAll(values)) throw new BadRequestException("Invalid answer values");
                }
                default -> {
                    var value = objectMapper.readValue(answerJson, String.class);
                    var allowed = snapshot.options().stream().map(TrainingQuestionOptionViewDto::text).collect(Collectors.toSet());
                    if (!allowed.contains(value)) throw new BadRequestException("Invalid answer values");
                }
            }
        } catch (BadRequestException e) {
            throw e;
        } catch (Exception e) {
            throw new BadRequestException("Invalid answer format");
        }
    }

    private boolean isAnswerCorrect(String answerJson, String correctKeyJson, TrainingQuestionType type) {
        try {
            if (type == TrainingQuestionType.MATCH) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<MatchPairAnswer>>() {})
                        .stream().sorted(Comparator.comparing(MatchPairAnswer::left)).toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<MatchPairAnswer>>() {})
                        .stream().sorted(Comparator.comparing(MatchPairAnswer::left)).toList();
                return expected.equals(actual);
            }
            if (type == TrainingQuestionType.MULTI) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {})
                        .stream().sorted().toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<String>>() {})
                        .stream().sorted().toList();
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
            var folder = folders.findByIdAndRestaurantId(folderId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
                throw new BadRequestException("Exam scope accepts only QUESTION_BANK folders");
            }
            entities.add(TrainingExamScope.builder().exam(exam).folder(folder).build());
        }
        scopes.saveAll(entities);
    }

    private TrainingExamDto toDtoWithScopes(TrainingExam exam) {
        var scopeIds = scopes.findByExamId(exam.getId()).stream()
                .map(s -> s.getFolder().getId())
                .toList();
        return toDto(exam, scopeIds);
    }

    private TrainingExamDto toDto(TrainingExam exam, List<Long> scopeIds) {
        return new TrainingExamDto(
                exam.getId(),
                exam.getRestaurant().getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getQuestionCount(),
                exam.getPassPercent(),
                exam.getTimeLimitSec(),
                exam.getVersion(),
                exam.isActive(),
                scopeIds
        );
    }

    private record SnapshotPayload(AttemptQuestionSnapshotDto snapshotDto, String snapshotJson, String correctKeyJson) {}

    private record MatchPairAnswer(String left, String right) {}
}