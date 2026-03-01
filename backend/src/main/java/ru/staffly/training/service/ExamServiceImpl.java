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
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.repository.RestaurantMemberRepository;
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
    private final TrainingExamSourceFolderRepository sourceFolders;
    private final TrainingExamSourceQuestionRepository sourceQuestions;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository questionOptions;
    private final TrainingQuestionMatchPairRepository questionPairs;
    private final TrainingQuestionBlankRepository questionBlanks;
    private final TrainingQuestionBlankOptionRepository questionBlankOptions;
    private final TrainingExamAttemptRepository attempts;
    private final TrainingExamAttemptQuestionRepository attemptQuestions;
    private final TrainingFolderRepository folders;
    private final RestaurantMemberRepository members;
    private final PositionRepository positions;
    private final ObjectMapper objectMapper;

    @Override
    public List<TrainingExamDto> listExams(Long restaurantId, Long userId, boolean isManager, boolean includeInactive, Boolean certificationOnly) {
        TrainingExamMode modeFilter = certificationOnly == null ? null : (certificationOnly ? TrainingExamMode.CERTIFICATION : TrainingExamMode.PRACTICE);

        List<TrainingExam> examList;
        if (isManager) {
            examList = includeInactive
                    ? exams.findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(restaurantId)
                    : exams.findByRestaurantIdAndActiveTrueWithVisibilityOrderByCreatedAtDesc(restaurantId);
            if (modeFilter != null) {
                examList = examList.stream().filter(e -> e.getMode() == modeFilter).toList();
            }
        } else {
            var member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Membership not found"));
            Long positionId = member.getPosition() == null ? -1L : member.getPosition().getId();
            examList = exams.listVisibleForStaff(restaurantId, positionId, modeFilter);
        }

        return examList.stream().map(this::toDtoWithSourcesAndVisibility).toList();
    }

    @Override
    public List<TrainingExamDto> listPracticeExamsByKnowledgeFolder(Long restaurantId, Long userId, boolean isManager, Long folderId, boolean includeInactive) {
        var folder = folders.findByIdAndRestaurantId(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.KNOWLEDGE) {
            throw new BadRequestException("Folder must belong to knowledge base");
        }

        Long positionId = null;
        if (!isManager) {
            var member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Membership not found"));
            positionId = member.getPosition() == null ? -1L : member.getPosition().getId();
        }
        return exams.listPracticeByKnowledgeFolder(restaurantId, folderId, includeInactive, positionId)
                .stream()
                .map(this::toDtoWithSourcesAndVisibility)
                .toList();
    }

    @Override
    @Transactional
    public TrainingExamDto createExam(Long restaurantId, CreateTrainingExamRequest request) {
        var knowledgeFolder = resolveKnowledgeFolder(restaurantId, request.mode(), request.knowledgeFolderId());
        var exam = exams.save(TrainingExam.builder()
                .restaurant(Restaurant.builder().id(restaurantId).build())
                .title(request.title())
                .description(request.description())
                .questionCount(request.questionCount())
                .passPercent(request.passPercent())
                .timeLimitSec(request.timeLimitSec())
                .mode(request.mode())
                .knowledgeFolder(knowledgeFolder)
                .attemptLimit(request.attemptLimit())
                .active(true)
                .version(1)
                .build());

        replaceSources(restaurantId, exam, request.sourcesFolders(), request.sourceQuestionIds());
        replaceVisibility(restaurantId, exam, request.visibilityPositionIds());
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto createKnowledgeExam(Long restaurantId, CreateTrainingExamRequest request) {
        var normalized = new CreateTrainingExamRequest(
                request.title(),
                request.description(),
                request.questionCount(),
                request.passPercent(),
                request.timeLimitSec(),
                TrainingExamMode.PRACTICE,
                request.knowledgeFolderId(),
                request.attemptLimit(),
                request.visibilityPositionIds(),
                request.sourcesFolders(),
                request.sourceQuestionIds()
        );
        return createExam(restaurantId, normalized);
    }

    @Override
    @Transactional
    public TrainingExamDto updateExam(Long restaurantId, Long examId, UpdateTrainingExamRequest request) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        if (exam.getMode() != request.mode()) {
            throw new BadRequestException("Нельзя менять режим теста после создания.");
        }

        var knowledgeFolder = resolveKnowledgeFolder(restaurantId, request.mode(), request.knowledgeFolderId());

        exam.setTitle(request.title());
        exam.setDescription(request.description());
        exam.setQuestionCount(request.questionCount());
        exam.setPassPercent(request.passPercent());
        exam.setTimeLimitSec(request.timeLimitSec());
        exam.setKnowledgeFolder(knowledgeFolder);
        exam.setAttemptLimit(request.attemptLimit());
        exam.setActive(request.active() == null ? exam.isActive() : request.active());

        replaceSources(restaurantId, exam, request.sourcesFolders(), request.sourceQuestionIds());
        replaceVisibility(restaurantId, exam, request.visibilityPositionIds());
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto hideExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        exam.setActive(false);
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto restoreExam(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        exam.setActive(true);
        return toDtoWithSourcesAndVisibility(exam);
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
        var examIds = exams.findByRestaurantIdAndActiveTrueWithVisibilityOrderByCreatedAtDesc(restaurantId)
                .stream()
                .filter(exam -> exam.getMode() == TrainingExamMode.CERTIFICATION)
                .map(TrainingExam::getId)
                .toList();
        if (examIds.isEmpty()) return List.of();

        var progressByExamId = attempts
                .findCurrentPassedProgressByRestaurantAndUserAndExamIds(restaurantId, userId, examIds)
                .stream()
                .collect(Collectors.toMap(TrainingExamProgressProjection::getExamId, Function.identity(), (a, b) -> a));

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
    public StartExamResponseDto startExam(Long restaurantId, Long examId, Long userId, boolean isManager) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        if (!exam.isActive()) {
            throw new ConflictException("Экзамен скрыт. Нельзя начать прохождение.");
        }

        if (!isManager) {
            var member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Membership not found"));
            if (!exam.getVisibilityPositions().isEmpty()) {
                var positionId = member.getPosition() == null ? null : member.getPosition().getId();
                var visible = positionId != null
                        && exam.getVisibilityPositions().stream().anyMatch(x -> Objects.equals(x.getId(), positionId));
                if (!visible) {
                    throw new ConflictException("Экзамен недоступен для вашей должности.");
                }
            }
        }

        // ✅ RESUME: если есть незавершенная попытка на текущей версии экзамена — возвращаем её
        var existingAttemptOpt =
                attempts.findTopByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
                        examId, restaurantId, userId, exam.getVersion()
                );

        if (existingAttemptOpt.isPresent()) {
            var existingAttempt = existingAttemptOpt.get();
            var existingItems = attemptQuestions.findByAttemptId(existingAttempt.getId());

            var snapshots = existingItems.stream()
                    .map(x -> readSnapshot(x.getQuestionSnapshotJson()))
                    .toList();

            return new StartExamResponseDto(
                    existingAttempt.getId(),
                    existingAttempt.getStartedAt(),
                    existingAttempt.getExamVersion(),
                    toDtoWithSourcesAndVisibility(exam),
                    snapshots
            );
        }

        if (exam.getAttemptLimit() != null) {
            long usedAttempts = attempts.countByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNotNull(
                    examId, restaurantId, userId, exam.getVersion()
            );
            if (usedAttempts >= exam.getAttemptLimit()) {
                throw new ConflictException("Достигнут лимит попыток для этого теста.");
            }
        }

        var pool = buildQuestionPool(restaurantId, exam);
        if (pool.isEmpty()) throw new BadRequestException("No questions in exam scope");

        var questionIds = pool.stream().map(TrainingQuestion::getId).toList();
        var optionsByQuestion = questionOptions.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(o -> o.getQuestion().getId()));
        var pairsByQuestion = questionPairs.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(p -> p.getQuestion().getId()));
        var blanksByQuestion = questionBlanks.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(b -> b.getQuestion().getId()));

        var blankIds = blanksByQuestion.values().stream().flatMap(List::stream)
                .map(TrainingQuestionBlank::getId).toList();
        var blankOptionsByBlank = blankIds.isEmpty()
                ? Map.<Long, List<TrainingQuestionBlankOption>>of()
                : questionBlankOptions.findByBlankIdInOrderBySortOrderAscIdAsc(blankIds).stream()
                .collect(Collectors.groupingBy(o -> o.getBlank().getId()));

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
                    pairsByQuestion.getOrDefault(question.getId(), List.of()),
                    blanksByQuestion.getOrDefault(question.getId(), List.of()),
                    blankOptionsByBlank
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
                toDtoWithSourcesAndVisibility(exam),
                snapshots
        );
    }

    @Override
    @Transactional
    public AttemptResultDto submitAttempt(Long restaurantId, Long attemptId, Long userId, SubmitAttemptRequestDto request) {
        var attempt = attempts.findByIdAndRestaurantId(attemptId, restaurantId).orElseThrow(() -> new NotFoundException("Attempt not found"));
        if (!Objects.equals(attempt.getUser().getId(), userId)) throw new BadRequestException("Attempt belongs to another user");
        if (attempt.getFinishedAt() != null) throw new ConflictException("Attempt already finished");

        var existing = attemptQuestions.findByAttemptId(attemptId);
        var byQuestionId = request.answers().stream().collect(Collectors.toMap(SubmitAttemptAnswerDto::questionId, Function.identity(), (a, b) -> b));

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
                existing.stream().map(x -> new AttemptResultQuestionDto(readSnapshot(x.getQuestionSnapshotJson()).questionId(), x.getChosenAnswerJson(), x.isCorrect())).toList()
        );
    }

    @Override
    public List<TrainingExamResultDto> listExamResults(Long restaurantId, Long examId, Long positionId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId).orElseThrow(() -> new NotFoundException("Exam not found"));
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Отчетность доступна только для аттестаций.");
        }
        return attempts.listExamResults(restaurantId, examId, exam.getVersion(), positionId)
                .stream()
                .map(r -> new TrainingExamResultDto(
                        r.getUserId(),
                        r.getFullName(),
                        r.getAttemptsUsed() == null ? 0 : r.getAttemptsUsed(),
                        r.getBestScore(),
                        r.getLastAttemptAt(),
                        Boolean.TRUE.equals(r.getPassed())
                ))
                .toList();
    }

    private SnapshotPayload buildSnapshot(TrainingQuestion question, List<TrainingQuestionOption> options, List<TrainingQuestionMatchPair> pairs, List<TrainingQuestionBlank> blanks, Map<Long, List<TrainingQuestionBlankOption>> blankOptionsByBlank) {
        try {
            var optionView = options.stream().map(o -> new TrainingQuestionOptionViewDto(o.getSortOrder(), o.getText())).toList();
            var pairView = pairs.stream().map(p -> new TrainingQuestionMatchPairViewDto(p.getSortOrder(), p.getLeftText(), p.getRightText())).toList();
            var blankView = blanks.stream().sorted(Comparator.comparing(TrainingQuestionBlank::getSortOrder)).map(blank -> new TrainingQuestionBlankViewDto(
                    blank.getSortOrder() + 1,
                    blankOptionsByBlank.getOrDefault(blank.getId(), List.of()).stream().map(o -> new TrainingQuestionBlankOptionViewDto(o.getSortOrder(), o.getText())).toList()
            )).toList();
            var snapshotDto = new AttemptQuestionSnapshotDto(question.getId(), question.getType(), question.getPrompt(), question.getExplanation(), optionView, pairView, blankView);
            String snapshotJson = objectMapper.writeValueAsString(snapshotDto);

            String correctKey;
            if (question.getType() == TrainingQuestionType.MATCH) {
                correctKey = objectMapper.writeValueAsString(pairs.stream().map(p -> new MatchPairAnswer(p.getLeftText(), p.getRightText())).sorted(Comparator.comparing(MatchPairAnswer::left)).toList());
            } else if (question.getType() == TrainingQuestionType.MULTI) {
                correctKey = objectMapper.writeValueAsString(options.stream().filter(TrainingQuestionOption::isCorrect).map(TrainingQuestionOption::getText).sorted().toList());
            } else if (question.getType() == TrainingQuestionType.FILL_SELECT && !blankView.isEmpty()) {
                var key = blanks.stream().sorted(Comparator.comparing(TrainingQuestionBlank::getSortOrder)).map(blank -> {
                    var correct = blankOptionsByBlank.getOrDefault(blank.getId(), List.of()).stream().filter(TrainingQuestionBlankOption::isCorrect).map(TrainingQuestionBlankOption::getText).findFirst().orElse("");
                    return new FillBlankCorrectAnswer(blank.getSortOrder() + 1, correct);
                }).toList();
                correctKey = objectMapper.writeValueAsString(key);
            } else {
                correctKey = objectMapper.writeValueAsString(options.stream().filter(TrainingQuestionOption::isCorrect).map(TrainingQuestionOption::getText).findFirst().orElse(""));
            }
            return new SnapshotPayload(snapshotDto, snapshotJson, correctKey);
        } catch (Exception e) {
            throw new BadRequestException("Cannot serialize exam snapshot");
        }
    }

    private AttemptQuestionSnapshotDto readSnapshot(String snapshotJson) {
        try { return objectMapper.readValue(snapshotJson, AttemptQuestionSnapshotDto.class); }
        catch (Exception e) { throw new BadRequestException("Invalid question snapshot"); }
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
                        if (!allowedLeft.contains(pair.left()) || !allowedRight.contains(pair.right()) || !lefts.add(pair.left()) || !rights.add(pair.right())) {
                            throw new BadRequestException("Invalid answer values");
                        }
                    }
                }
                case MULTI -> {
                    var values = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {});
                    var allowed = snapshot.options().stream().map(TrainingQuestionOptionViewDto::text).collect(Collectors.toSet());
                    if (!allowed.containsAll(values)) throw new BadRequestException("Invalid answer values");
                }
                case FILL_SELECT -> {
                    if (snapshot.blanks() == null || snapshot.blanks().isEmpty()) {
                        var value = objectMapper.readValue(answerJson, String.class);
                        var allowed = snapshot.options().stream().map(TrainingQuestionOptionViewDto::text).collect(Collectors.toSet());
                        if (!allowed.contains(value)) throw new BadRequestException("Invalid answer values");
                        return;
                    }
                    var values = objectMapper.readValue(answerJson, new TypeReference<List<FillBlankAnswer>>() {});
                    if (values.size() != snapshot.blanks().size()) throw new BadRequestException("Invalid answer values");
                    var byIndex = values.stream().collect(Collectors.toMap(FillBlankAnswer::blankIndex, FillBlankAnswer::value, (a, b) -> b));
                    if (byIndex.size() != values.size()) throw new BadRequestException("Invalid answer values");
                    for (var blank : snapshot.blanks()) {
                        var value = byIndex.get(blank.blankIndex());
                        if (value == null) throw new BadRequestException("Invalid answer values");
                        var allowed = blank.options().stream().map(TrainingQuestionBlankOptionViewDto::text).collect(Collectors.toSet());
                        if (!allowed.contains(value)) throw new BadRequestException("Invalid answer values");
                    }
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
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<MatchPairAnswer>>() {}).stream().sorted(Comparator.comparing(MatchPairAnswer::left)).toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<MatchPairAnswer>>() {}).stream().sorted(Comparator.comparing(MatchPairAnswer::left)).toList();
                return expected.equals(actual);
            }
            if (type == TrainingQuestionType.MULTI) {
                var actual = objectMapper.readValue(answerJson, new TypeReference<List<String>>() {}).stream().sorted().toList();
                var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<String>>() {}).stream().sorted().toList();
                return expected.equals(actual);
            }
            if (type == TrainingQuestionType.FILL_SELECT) {
                if (correctKeyJson != null && correctKeyJson.trim().startsWith("[")) {
                    var actual = objectMapper.readValue(answerJson, new TypeReference<List<FillBlankAnswer>>() {}).stream().sorted(Comparator.comparing(FillBlankAnswer::blankIndex)).toList();
                    var expected = objectMapper.readValue(correctKeyJson, new TypeReference<List<FillBlankCorrectAnswer>>() {}).stream().sorted(Comparator.comparing(FillBlankCorrectAnswer::blankIndex)).toList();
                    if (actual.size() != expected.size()) return false;
                    for (int i = 0; i < expected.size(); i++) {
                        if (!Objects.equals(expected.get(i).blankIndex(), actual.get(i).blankIndex()) || !Objects.equals(expected.get(i).correct(), actual.get(i).value())) return false;
                    }
                    return true;
                }
            }
            String actual = objectMapper.readValue(answerJson, String.class);
            String expected = objectMapper.readValue(correctKeyJson, String.class);
            return Objects.equals(expected, actual);
        } catch (Exception e) {
            throw new BadRequestException("Invalid answer payload");
        }
    }

    private List<TrainingQuestion> buildQuestionPool(Long restaurantId, TrainingExam exam) {
        TrainingQuestionGroup group = exam.getMode() == TrainingExamMode.PRACTICE ? TrainingQuestionGroup.PRACTICE : TrainingQuestionGroup.CERTIFICATION;

        var uniqueById = new LinkedHashMap<Long, TrainingQuestion>();
        var folderSourcesList = sourceFolders.findByExamId(exam.getId());
        for (var source : folderSourcesList) {
            var folderQuestions = questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(
                    restaurantId,
                    source.getFolder().getId(),
                    group
            );
            if (source.getPickMode() == TrainingExamSourcePickMode.RANDOM) {
                Collections.shuffle(folderQuestions);
                int take = Math.min(source.getRandomCount() == null ? 0 : source.getRandomCount(), folderQuestions.size());
                folderQuestions = folderQuestions.subList(0, take);
            }
            for (var q : folderQuestions) {
                uniqueById.put(q.getId(), q);
            }
        }

        var questionIds = sourceQuestions.findByExamId(exam.getId()).stream()
                .map(x -> x.getQuestion().getId())
                .distinct()
                .toList();
        if (!questionIds.isEmpty()) {
            var explicitQuestions = questions.findActiveByRestaurantIdAndIdIn(restaurantId, questionIds).stream()
                    .filter(q -> q.getQuestionGroup() == group)
                    .toList();
            for (var q : explicitQuestions) {
                uniqueById.put(q.getId(), q);
            }
        }

        var pool = new ArrayList<>(uniqueById.values());
        Collections.shuffle(pool);
        int count = Math.min(exam.getQuestionCount(), pool.size());
        return pool.subList(0, count);
    }

    private void replaceSources(Long restaurantId, TrainingExam exam, List<ExamSourceFolderDto> foldersDto, List<Long> sourceQuestionIds) {
        sourceFolders.deleteByExamId(exam.getId());
        sourceQuestions.deleteByExamId(exam.getId());

        var folderEntities = new ArrayList<TrainingExamSourceFolder>();
        for (var folderSource : (foldersDto == null ? List.<ExamSourceFolderDto>of() : foldersDto).stream().distinct().toList()) {
            var folder = folders.findByIdAndRestaurantId(folderSource.folderId(), restaurantId).orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) throw new BadRequestException("Exam scope accepts only QUESTION_BANK folders");
            if (folderSource.pickMode() == TrainingExamSourcePickMode.RANDOM && (folderSource.randomCount() == null || folderSource.randomCount() < 1)) {
                throw new BadRequestException("randomCount is required for RANDOM pick mode");
            }
            folderEntities.add(TrainingExamSourceFolder.builder()
                    .exam(exam)
                    .folder(folder)
                    .pickMode(folderSource.pickMode())
                    .randomCount(folderSource.pickMode() == TrainingExamSourcePickMode.RANDOM ? folderSource.randomCount() : null)
                    .build());
        }
        if (!folderEntities.isEmpty()) {
            sourceFolders.saveAll(folderEntities);
        }

        var questionEntities = new ArrayList<TrainingExamSourceQuestion>();
        for (Long questionId : (sourceQuestionIds == null ? List.<Long>of() : sourceQuestionIds).stream().distinct().toList()) {
            var question = questions.findByIdAndRestaurantId(questionId, restaurantId).orElseThrow(() -> new NotFoundException("Question not found"));
            questionEntities.add(TrainingExamSourceQuestion.builder().exam(exam).question(question).build());
        }
        if (!questionEntities.isEmpty()) {
            sourceQuestions.saveAll(questionEntities);
        }
    }

    private void replaceVisibility(Long restaurantId, TrainingExam exam, List<Long> visibilityPositionIds) {
        exam.getVisibilityPositions().clear();
        if (visibilityPositionIds == null || visibilityPositionIds.isEmpty()) return;
        var allowed = positions.findByRestaurantId(restaurantId).stream().collect(Collectors.toMap(Position::getId, Function.identity()));
        for (Long positionId : visibilityPositionIds.stream().distinct().toList()) {
            var position = allowed.get(positionId);
            if (position == null) throw new NotFoundException("Position not found");
            exam.getVisibilityPositions().add(position);
        }
    }

    private TrainingExamDto toDtoWithSourcesAndVisibility(TrainingExam exam) {
        var folders = sourceFolders.findByExamId(exam.getId()).stream()
                .map(s -> new ExamSourceFolderDto(s.getFolder().getId(), s.getPickMode(), s.getRandomCount()))
                .toList();
        var questionIds = sourceQuestions.findByExamId(exam.getId()).stream().map(s -> s.getQuestion().getId()).toList();
        var visibilityIds = exam.getVisibilityPositions().stream().map(Position::getId).sorted().toList();
        return new TrainingExamDto(
                exam.getId(),
                exam.getRestaurant().getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getQuestionCount(),
                exam.getPassPercent(),
                exam.getTimeLimitSec(),
                exam.getMode(),
                exam.getKnowledgeFolder() == null ? null : exam.getKnowledgeFolder().getId(),
                exam.getAttemptLimit(),
                exam.getVersion(),
                exam.isActive(),
                folders,
                questionIds,
                visibilityIds
        );
    }

    private TrainingFolder resolveKnowledgeFolder(Long restaurantId, TrainingExamMode mode, Long knowledgeFolderId) {
        if (mode == TrainingExamMode.PRACTICE) {
            if (knowledgeFolderId == null) {
                throw new BadRequestException("Для учебного теста требуется папка в базе знаний.");
            }
            var folder = folders.findByIdAndRestaurantId(knowledgeFolderId, restaurantId)
                    .orElseThrow(() -> new BadRequestException("Папка учебного теста не найдена."));
            if (folder.getType() != TrainingFolderType.KNOWLEDGE) {
                throw new BadRequestException("Для учебного теста нужна папка из базы знаний.");
            }
            return folder;
        }

        if (knowledgeFolderId != null) {
            throw new BadRequestException("Для аттестации папка в базе знаний не задаётся.");
        }
        return null;
    }

    private record SnapshotPayload(AttemptQuestionSnapshotDto snapshotDto, String snapshotJson, String correctKeyJson) {}
    private record MatchPairAnswer(String left, String right) {}
    private record FillBlankAnswer(Integer blankIndex, String value) {}
    private record FillBlankCorrectAnswer(Integer blankIndex, String correct) {}
}
