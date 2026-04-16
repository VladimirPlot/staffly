package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;
import ru.staffly.user.model.User;

import java.time.Instant;
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
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingFolderRepository folders;
    private final PositionRepository positions;

    private final TrainingExamAccessService examAccessService;
    private final ExamQuestionPoolResolver questionPoolResolver;
    private final ExamSnapshotService snapshotService;
    private final ExamAttemptEvaluator attemptEvaluator;
    private final CertificationAssignmentSyncService assignmentSyncService;
    private final CertificationAssignmentService certificationAssignmentService;
    private final CertificationAssignmentLifecycleService certificationAssignmentLifecycleService;
    private final CertificationManagerActionService certificationManagerActionService;
    private final CertificationAnalyticsService certificationAnalyticsService;
    private final CertificationSelfResultService certificationSelfResultService;
    private final TrainingPolicyService trainingPolicyService;

    @Override
    @Transactional(readOnly = true)
    public List<TrainingExamDto> listExams(Long restaurantId, Long userId, boolean isManager, boolean includeInactive, Boolean certificationOnly) {
        TrainingExamMode modeFilter = certificationOnly == null
                ? null
                : (certificationOnly ? TrainingExamMode.CERTIFICATION : TrainingExamMode.PRACTICE);

        return examAccessService.listVisibleExams(restaurantId, userId, isManager, includeInactive, modeFilter)
                .stream()
                .map(this::toDtoWithSourcesAndVisibility)
                .toList();
    }

    @Override
    @Transactional
    public List<CurrentUserCertificationExamDto> listCurrentUserCertificationExams(Long restaurantId, Long userId) {
        // Read-repair semantics: listing certifications can finalize stale expired unfinished attempts
        // and update assignment derived fields/status to keep list/start/result consistent.
        Instant now = TimeProvider.now();
        return assignments.findActiveCertificationAssignmentsForUser(restaurantId, userId)
                .stream()
                .map(assignment -> certificationAssignmentLifecycleService.normalize(assignment, now))
                .map(this::toCurrentUserCertificationExamDto)
                .toList();
    }

    @Override
    @Transactional
    public CertificationMyResultDto getCurrentUserCertificationResult(Long restaurantId, Long examId, Long userId, boolean isManager) {
        // Read-repair semantics: self-result can mutate DB by repairing stale lifecycle state
        // (e.g. finalize expired unfinished attempt before building result).
        Instant now = TimeProvider.now();
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        var assignment = certificationAssignmentService.findActiveForExamAndUser(examId, restaurantId, userId)
                .map(item -> certificationAssignmentLifecycleService.normalize(item, now))
                .orElse(null);
        return certificationSelfResultService.getCurrentUserResult(exam, restaurantId, userId, assignment);
    }

    @Override
    @Transactional(readOnly = true)
    public List<TrainingExamDto> listPracticeExamsByKnowledgeFolder(Long restaurantId, Long userId, boolean isManager, Long folderId, boolean includeInactive) {
        var folder = folders.findByIdAndRestaurantIdWithVisibility(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.KNOWLEDGE) {
            throw new BadRequestException("Folder must belong to knowledge base");
        }
        trainingPolicyService.assertCanAccessKnowledgeByVisibility(
                userId,
                restaurantId,
                folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
        );

        return examAccessService.listVisiblePracticeExamsByKnowledgeFolder(restaurantId, userId, isManager, folderId, includeInactive)
                .stream()
                .map(this::toDtoWithSourcesAndVisibility)
                .toList();
    }

    @Override
    @Transactional
    public TrainingExamDto createExam(Long restaurantId, Long userId, CreateTrainingExamRequest request) {
        validateCertificationVisibility(request.mode(), request.visibilityPositionIds());
        var knowledgeFolder = resolveKnowledgeFolder(restaurantId, userId, request.mode(), request.knowledgeFolderId());
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

        replaceSources(restaurantId, userId, exam, request.mode(), request.sourcesFolders(), request.sourceQuestionIds());
        replaceVisibility(restaurantId, userId, exam, request.visibilityPositionIds());
        assignmentSyncService.syncForExam(exam);
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto createKnowledgeExam(Long restaurantId, Long userId, CreateTrainingExamRequest request) {
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
        return createExam(restaurantId, userId, normalized);
    }

    @Override
    @Transactional
    public TrainingExamDto updateExam(Long restaurantId, Long userId, Long examId, UpdateTrainingExamRequest request) {
        var exam = requireManageableExam(restaurantId, userId, examId);

        if (exam.getMode() != request.mode()) {
            throw new BadRequestException("Нельзя менять режим теста после создания.");
        }

        // UpdateTrainingExamRequest uses full-replace semantics for visibility collections.
        // For certification exams null/empty means "clear visibility", which is invalid.
        validateCertificationVisibility(request.mode(), request.visibilityPositionIds());
        var knowledgeFolder = resolveKnowledgeFolder(restaurantId, userId, request.mode(), request.knowledgeFolderId());

        exam.setTitle(request.title());
        exam.setDescription(request.description());
        exam.setQuestionCount(request.questionCount());
        exam.setPassPercent(request.passPercent());
        exam.setTimeLimitSec(request.timeLimitSec());
        exam.setKnowledgeFolder(knowledgeFolder);
        exam.setAttemptLimit(request.attemptLimit());
        exam.setActive(request.active() == null ? exam.isActive() : request.active());

        replaceSources(restaurantId, userId, exam, request.mode(), request.sourcesFolders(), request.sourceQuestionIds());
        replaceVisibility(restaurantId, userId, exam, request.visibilityPositionIds());
        assignmentSyncService.syncForExam(exam);
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto hideExam(Long restaurantId, Long userId, Long examId) {
        var exam = requireManageableExam(restaurantId, userId, examId);
        exam.setActive(false);
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public TrainingExamDto restoreExam(Long restaurantId, Long userId, Long examId) {
        var exam = requireManageableExam(restaurantId, userId, examId);
        exam.setActive(true);
        assignmentSyncService.syncForExam(exam);
        return toDtoWithSourcesAndVisibility(exam);
    }

    @Override
    @Transactional
    public void deleteExam(Long restaurantId, Long userId, Long examId) {
        var exam = requireManageableExam(restaurantId, userId, examId);

        if (exam.isActive()) {
            throw new ConflictException("Сначала скройте экзамен, затем удаляйте.");
        }
        exams.delete(exam);
    }

    @Override
    @Transactional
    public void resetCertificationExamCycle(Long restaurantId, Long userId, Long examId) {
        var exam = requireManageableCertificationExam(restaurantId, userId, examId);
        startNewCertificationCycle(exam);
        assignmentSyncService.resetAssignmentsForNewCycle(exam);
    }

    @Override
    public List<TrainingExamProgressDto> listCurrentUserPracticeExamProgress(Long restaurantId, Long userId) {
        // Practice-only progress endpoint: только по practice-экзаменам, доступным пользователю по visibility.
        var examIds = examAccessService.listVisiblePracticeExamIdsForUser(restaurantId, userId);
        if (examIds.isEmpty()) {
            return List.of();
        }

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
        Instant now = TimeProvider.now();
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        if (!exam.isActive()) {
            throw new ConflictException("Экзамен скрыт. Нельзя начать прохождение.");
        }

        examAccessService.ensureCanStartExam(exam, restaurantId, userId, isManager);

        TrainingExamAssignment assignment = null;
        int attemptVersion = exam.getVersion();
        if (exam.getMode() == TrainingExamMode.CERTIFICATION) {
            assignment = certificationAssignmentLifecycleService.normalizeForStart(
                    exam,
                    restaurantId,
                    userId,
                    now
            );
            attemptVersion = assignment.getExamVersionSnapshot();
        }

        var existingAttemptOpt = exam.getMode() == TrainingExamMode.CERTIFICATION && assignment != null
                ? certificationAssignmentLifecycleService.findUnfinishedCurrentAttempt(assignment)
                : attempts.findTopByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
                examId, restaurantId, userId, attemptVersion);
        if (existingAttemptOpt.isPresent()) {
            return resumeAttempt(exam, existingAttemptOpt.get());
        }

        if (exam.getMode() == TrainingExamMode.CERTIFICATION && assignment != null) {
            certificationAssignmentService.ensureAttemptsAvailable(assignment);
            certificationAssignmentService.markStarted(assignment);
        } else {
            enforceAttemptLimit(exam, restaurantId, userId, attemptVersion);
        }

        var pool = questionPoolResolver.buildQuestionPool(restaurantId, exam);
        if (pool.isEmpty()) {
            throw new BadRequestException("No questions in exam scope");
        }

        var selectedQuestions = pickQuestionsForAttempt(pool, exam.getQuestionCount());
        var relationData = loadQuestionRelations(selectedQuestions);
        var attempt = createAttempt(exam, userId, assignment, attemptVersion, now);
        var snapshots = persistAttemptQuestions(attempt, selectedQuestions, relationData);

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
        var attempt = attempts.findByIdAndRestaurantId(attemptId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Attempt not found"));
        if (!Objects.equals(attempt.getUser().getId(), userId)) {
            throw new BadRequestException("Attempt belongs to another user");
        }
        if (attempt.getFinishedAt() != null) {
            throw new ConflictException("Attempt already finished");
        }

        var answersByQuestionId = request.answers().stream()
                .collect(Collectors.toMap(SubmitAttemptAnswerDto::questionId, Function.identity(), (first, second) -> second));
        return finalizeAttempt(attempt, answersByQuestionId, TimeProvider.now());
    }

    @Override
    public void resetEmployeeCertificationAttempts(Long restaurantId, Long actorUserId, Long examId, Long userId) {
        requireManageableCertificationExam(restaurantId, actorUserId, examId);
        certificationManagerActionService.resetAttemptsForEmployee(restaurantId, examId, userId);
    }

    @Override
    public void grantEmployeeCertificationExtraAttempts(Long restaurantId, Long actorUserId, Long examId, Long userId, Integer amount) {
        requireManageableCertificationExam(restaurantId, actorUserId, examId);
        certificationManagerActionService.grantExtraAttemptForEmployee(restaurantId, examId, userId, amount);
    }

    @Override
    public CertificationExamSummaryDto getCertificationExamSummary(Long restaurantId, Long actorUserId, Long examId) {
        requireManageableCertificationExam(restaurantId, actorUserId, examId);
        return certificationAnalyticsService.getExamSummary(restaurantId, examId);
    }

    @Override
    public List<CertificationExamPositionBreakdownDto> getCertificationExamPositionBreakdown(Long restaurantId, Long actorUserId, Long examId) {
        requireManageableCertificationExam(restaurantId, actorUserId, examId);
        return certificationAnalyticsService.getPositionBreakdown(restaurantId, examId);
    }

    @Override
    public List<CertificationExamEmployeeRowDto> getCertificationExamEmployeeTable(Long restaurantId, Long actorUserId, Long examId) {
        requireManageableCertificationExam(restaurantId, actorUserId, examId);
        return certificationAnalyticsService.getEmployeeRows(restaurantId, examId);
    }

    @Override
    public List<CertificationExamAttemptHistoryDto> getCertificationEmployeeAttemptHistory(Long restaurantId, Long actorUserId, Long examId, Long userId) {
        requireManageableCertificationExam(restaurantId, actorUserId, examId);
        return certificationAnalyticsService.getEmployeeAttemptHistory(restaurantId, examId, userId);
    }

    private void startNewCertificationCycle(TrainingExam exam) {
        // certification reset-cycle открывает новый глобальный assignment cycle.
        // Это не per-user reset: все новые попытки пишутся под новой версией экзамена.
        exam.setVersion(exam.getVersion() + 1);
    }

    private StartExamResponseDto resumeAttempt(TrainingExam exam, TrainingExamAttempt existingAttempt) {
        var snapshots = attemptQuestions.findByAttemptId(existingAttempt.getId()).stream()
                .map(item -> snapshotService.readSnapshot(item.getQuestionSnapshotJson()))
                .toList();

        return new StartExamResponseDto(
                existingAttempt.getId(),
                existingAttempt.getStartedAt(),
                existingAttempt.getExamVersion(),
                toDtoWithSourcesAndVisibility(exam),
                snapshots
        );
    }

    private AttemptResultDto finalizeAttempt(TrainingExamAttempt attempt,
                                             Map<Long, SubmitAttemptAnswerDto> answersByQuestionId,
                                             Instant finishedAt) {
        var existingQuestions = attemptQuestions.findByAttemptId(attempt.getId());
        int correctAnswers = 0;
        for (var item : existingQuestions) {
            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
            var answer = answersByQuestionId.get(snapshot.questionId());

            if (answer != null) {
                if (answer.answerJson() == null || answer.answerJson().isBlank()) {
                    item.setChosenAnswerJson(null);
                    item.setCorrect(false);
                    continue;
                }

                attemptEvaluator.validateAnswerForType(answer.answerJson(), snapshot);
                item.setChosenAnswerJson(answer.answerJson());
                boolean correct = attemptEvaluator.isAnswerCorrect(answer.answerJson(), item.getCorrectKeyJson(), snapshot.type());
                item.setCorrect(correct);
                if (correct) {
                    correctAnswers++;
                }
                continue;
            }

            if (item.getChosenAnswerJson() == null || item.getChosenAnswerJson().isBlank()) {
                item.setChosenAnswerJson(null);
                item.setCorrect(false);
                continue;
            }

            boolean correct = attemptEvaluator.isAnswerCorrect(item.getChosenAnswerJson(), item.getCorrectKeyJson(), snapshot.type());
            item.setCorrect(correct);
            if (correct) {
                correctAnswers++;
            }
        }

        int scorePercent = existingQuestions.isEmpty()
                ? 0
                : (int) Math.round((correctAnswers * 100.0) / existingQuestions.size());

        attempt.setFinishedAt(finishedAt);
        attempt.setScorePercent(scorePercent);
        attempt.setPassed(scorePercent >= attempt.getPassPercentSnapshot());
        if (attempt.getExam() != null && attempt.getExam().getMode() == TrainingExamMode.CERTIFICATION) {
            certificationAssignmentService.updateOnSubmit(attempt);
        }

        return new AttemptResultDto(
                attempt.getId(),
                attempt.getExam() == null ? null : attempt.getExam().getId(),
                attempt.getExamVersion(),
                attempt.getUser().getId(),
                attempt.getStartedAt(),
                attempt.getFinishedAt(),
                attempt.getScorePercent(),
                attempt.getPassed(),
                existingQuestions.stream()
                        .map(question -> new AttemptResultQuestionDto(
                                snapshotService.readSnapshot(question.getQuestionSnapshotJson()).questionId(),
                                question.getChosenAnswerJson(),
                                question.isCorrect()
                        ))
                        .toList()
        );
    }

    private void enforceAttemptLimit(TrainingExam exam, Long restaurantId, Long userId, int examVersion) {
        if (exam.getAttemptLimit() == null) {
            return;
        }

        long usedAttempts = attempts.countByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNotNull(
                exam.getId(),
                restaurantId,
                userId,
                examVersion
        );
        if (usedAttempts >= exam.getAttemptLimit()) {
            throw new ConflictException("Достигнут лимит попыток для этого теста.");
        }
    }

    private List<TrainingQuestion> pickQuestionsForAttempt(List<TrainingQuestion> pool, Integer requestedCount) {
        var mutablePool = new ArrayList<>(pool);
        Collections.shuffle(mutablePool);
        int count = Math.min(requestedCount, mutablePool.size());
        return mutablePool.subList(0, count);
    }

    private QuestionRelations loadQuestionRelations(List<TrainingQuestion> selectedQuestions) {
        var questionIds = selectedQuestions.stream().map(TrainingQuestion::getId).toList();

        var optionsByQuestion = questionOptions.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(option -> option.getQuestion().getId()));
        var pairsByQuestion = questionPairs.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(pair -> pair.getQuestion().getId()));
        var blanksByQuestion = questionBlanks.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(blank -> blank.getQuestion().getId()));

        var blankIds = blanksByQuestion.values().stream().flatMap(List::stream).map(TrainingQuestionBlank::getId).toList();
        var blankOptionsByBlank = blankIds.isEmpty()
                ? Map.<Long, List<TrainingQuestionBlankOption>>of()
                : questionBlankOptions.findByBlankIdInOrderBySortOrderAscIdAsc(blankIds).stream()
                .collect(Collectors.groupingBy(option -> option.getBlank().getId()));

        return new QuestionRelations(optionsByQuestion, pairsByQuestion, blanksByQuestion, blankOptionsByBlank);
    }

    private TrainingExamAttempt createAttempt(TrainingExam exam,
                                              Long userId,
                                              TrainingExamAssignment assignment,
                                              int examVersion,
                                              Instant now) {
        return attempts.save(TrainingExamAttempt.builder()
                .exam(exam)
                .examVersion(examVersion)
                .restaurant(exam.getRestaurant())
                .assignment(assignment)
                .user(User.builder().id(userId).build())
                .startedAt(now)
                .passPercentSnapshot(exam.getPassPercent())
                .titleSnapshot(exam.getTitle())
                .questionCountSnapshot(exam.getQuestionCount())
                .timeLimitSecSnapshot(exam.getTimeLimitSec())
                .build());
    }

    private List<AttemptQuestionSnapshotDto> persistAttemptQuestions(TrainingExamAttempt attempt,
                                                                     List<TrainingQuestion> selectedQuestions,
                                                                     QuestionRelations relations) {
        List<TrainingExamAttemptQuestion> entities = new ArrayList<>();
        List<AttemptQuestionSnapshotDto> snapshots = new ArrayList<>();

        for (var question : selectedQuestions) {
            var snapshot = snapshotService.buildSnapshot(
                    question,
                    relations.optionsByQuestion().getOrDefault(question.getId(), List.of()),
                    relations.pairsByQuestion().getOrDefault(question.getId(), List.of()),
                    relations.blanksByQuestion().getOrDefault(question.getId(), List.of()),
                    relations.blankOptionsByBlank()
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
        return snapshots;
    }

    private void replaceSources(Long restaurantId,
                                Long userId,
                                TrainingExam exam,
                                TrainingExamMode examMode,
                                List<ExamSourceFolderDto> foldersDto,
                                List<Long> sourceQuestionIds) {
        sourceFolders.deleteByExamId(exam.getId());
        sourceFolders.flush();
        sourceQuestions.deleteByExamId(exam.getId());
        sourceQuestions.flush();

        var requiredGroup = questionGroupForMode(examMode);
        var folderEntities = new ArrayList<TrainingExamSourceFolder>();
        for (var folderSource : normalizeFolderSources(foldersDto)) {
            var folder = folders.findByIdAndRestaurantIdWithVisibility(folderSource.folderId(), restaurantId)
                    .orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
                throw new BadRequestException("Exam scope accepts only QUESTION_BANK folders");
            }
            trainingPolicyService.assertCanAccessQuestionBankByVisibility(
                    userId,
                    restaurantId,
                    folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
            );
            if (folderSource.pickMode() == TrainingExamSourcePickMode.RANDOM
                    && (folderSource.randomCount() == null || folderSource.randomCount() < 1)) {
                throw new BadRequestException("randomCount is required for RANDOM pick mode");
            }
            var folderHasQuestionsInExamMode = !questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(
                    restaurantId,
                    folder.getId(),
                    requiredGroup
            ).isEmpty();
            if (!folderHasQuestionsInExamMode) {
                throw new BadRequestException("Folder does not contain active questions for selected exam mode");
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
            var question = questions.findByIdAndRestaurantIdWithFolderVisibility(questionId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Question not found"));
            if (!question.isActive()) {
                throw new BadRequestException("Inactive questions cannot be used as explicit exam source");
            }
            if (question.getQuestionGroup() != requiredGroup) {
                throw new BadRequestException("Question group does not match exam mode");
            }
            trainingPolicyService.assertCanAccessQuestionBankByVisibility(
                    userId,
                    restaurantId,
                    question.getFolder().getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
            );
            questionEntities.add(TrainingExamSourceQuestion.builder().exam(exam).question(question).build());
        }
        if (!questionEntities.isEmpty()) {
            sourceQuestions.saveAll(questionEntities);
        }
    }

    private List<ExamSourceFolderDto> normalizeFolderSources(List<ExamSourceFolderDto> foldersDto) {
        if (foldersDto == null || foldersDto.isEmpty()) {
            return List.of();
        }

        Map<Long, ExamSourceFolderDto> uniqueByFolderId = new LinkedHashMap<>();
        for (var source : foldersDto) {
            if (source == null || source.folderId() == null) {
                throw new BadRequestException("Folder source must contain folderId");
            }
            var existing = uniqueByFolderId.get(source.folderId());
            if (existing == null) {
                uniqueByFolderId.put(source.folderId(), source);
                continue;
            }

            boolean sameDefinition = existing.pickMode() == source.pickMode()
                    && Objects.equals(existing.randomCount(), source.randomCount());
            if (!sameDefinition) {
                throw new BadRequestException("Folder source contains duplicate folderId with different pick settings");
            }
        }
        return List.copyOf(uniqueByFolderId.values());
    }

    private void replaceVisibility(Long restaurantId, Long userId, TrainingExam exam, List<Long> visibilityPositionIds) {
        exam.getVisibilityPositions().clear();
        if (visibilityPositionIds == null || visibilityPositionIds.isEmpty()) {
            return;
        }
        trainingPolicyService.assertCanUseExamTargetPositions(
                userId,
                restaurantId,
                new HashSet<>(visibilityPositionIds)
        );

        var allowed = positions.findByRestaurantId(restaurantId)
                .stream()
                .collect(Collectors.toMap(Position::getId, Function.identity()));

        for (Long positionId : visibilityPositionIds.stream().distinct().toList()) {
            var position = allowed.get(positionId);
            if (position == null) {
                throw new NotFoundException("Position not found");
            }
            exam.getVisibilityPositions().add(position);
        }
    }

    private TrainingExamDto toDtoWithSourcesAndVisibility(TrainingExam exam) {
        var folders = sourceFolders.findByExamId(exam.getId()).stream()
                .map(source -> new ExamSourceFolderDto(source.getFolder().getId(), source.getPickMode(), source.getRandomCount()))
                .toList();
        var questionIds = sourceQuestions.findByExamId(exam.getId()).stream()
                .map(source -> source.getQuestion().getId())
                .toList();
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

    private CurrentUserCertificationExamDto toCurrentUserCertificationExamDto(TrainingExamAssignment assignment) {
        var exam = assignment.getExam();
        return new CurrentUserCertificationExamDto(
                exam.getId(),
                exam.getTitle(),
                exam.getDescription(),
                exam.getQuestionCount(),
                exam.getPassPercent(),
                exam.getTimeLimitSec(),
                assignment.getAttemptsLimitSnapshot(),
                exam.isActive(),
                assignment.getId(),
                assignment.getStatus(),
                assignment.getAssignedAt(),
                assignment.getExamVersionSnapshot(),
                assignment.getAttemptsUsed(),
                certificationAssignmentService.calculateAttemptsAllowed(assignment),
                assignment.getExtraAttempts(),
                assignment.getBestScore(),
                assignment.getLastAttemptAt(),
                assignment.getPassedAt()
        );
    }

    private void validateCertificationVisibility(TrainingExamMode mode, List<Long> visibilityPositionIds) {
        if (mode == TrainingExamMode.CERTIFICATION
                && (visibilityPositionIds == null || visibilityPositionIds.isEmpty())) {
            throw new BadRequestException("Для аттестации нужно указать хотя бы одну visibility-позицию (update работает как полный replace).");
        }
    }

    private TrainingFolder resolveKnowledgeFolder(Long restaurantId, Long userId, TrainingExamMode mode, Long knowledgeFolderId) {
        if (mode == TrainingExamMode.PRACTICE) {
            if (knowledgeFolderId == null) {
                throw new BadRequestException("Для учебного теста требуется папка в базе знаний.");
            }
            var folder = folders.findByIdAndRestaurantIdWithVisibility(knowledgeFolderId, restaurantId)
                    .orElseThrow(() -> new BadRequestException("Папка учебного теста не найдена."));
            if (folder.getType() != TrainingFolderType.KNOWLEDGE) {
                throw new BadRequestException("Для учебного теста нужна папка из базы знаний.");
            }
            trainingPolicyService.assertCanAccessKnowledgeByVisibility(
                    userId,
                    restaurantId,
                    folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
            );
            return folder;
        }

        if (knowledgeFolderId != null) {
            throw new BadRequestException("Для аттестации папка в базе знаний не задаётся.");
        }
        return null;
    }

    private TrainingQuestionGroup questionGroupForMode(TrainingExamMode mode) {
        return mode == TrainingExamMode.PRACTICE
                ? TrainingQuestionGroup.PRACTICE
                : TrainingQuestionGroup.CERTIFICATION;
    }

    private TrainingExam requireManageableExam(Long restaurantId, Long userId, Long examId) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        trainingPolicyService.assertCanAccessExamTargetByVisibility(
                userId,
                restaurantId,
                exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
        );
        return exam;
    }

    private TrainingExam requireManageableCertificationExam(Long restaurantId, Long userId, Long examId) {
        var exam = requireManageableExam(restaurantId, userId, examId);
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Операция доступна только для аттестационного теста.");
        }
        return exam;
    }

    private record QuestionRelations(
            Map<Long, List<TrainingQuestionOption>> optionsByQuestion,
            Map<Long, List<TrainingQuestionMatchPair>> pairsByQuestion,
            Map<Long, List<TrainingQuestionBlank>> blanksByQuestion,
            Map<Long, List<TrainingQuestionBlankOption>> blankOptionsByBlank
    ) {
    }
}
