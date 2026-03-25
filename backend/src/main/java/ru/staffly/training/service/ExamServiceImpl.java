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
    private final PositionRepository positions;

    private final TrainingExamAccessService examAccessService;
    private final ExamQuestionPoolResolver questionPoolResolver;
    private final ExamSnapshotService snapshotService;
    private final ExamAttemptEvaluator attemptEvaluator;
    private final CertificationAssignmentSyncService assignmentSyncService;
    private final CertificationAssignmentService certificationAssignmentService;
    private final CertificationManagerActionService certificationManagerActionService;
    private final CertificationAnalyticsService certificationAnalyticsService;

    @Override
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
    public List<TrainingExamDto> listPracticeExamsByKnowledgeFolder(Long restaurantId, Long userId, boolean isManager, Long folderId, boolean includeInactive) {
        var folder = folders.findByIdAndRestaurantId(folderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Folder not found"));
        if (folder.getType() != TrainingFolderType.KNOWLEDGE) {
            throw new BadRequestException("Folder must belong to knowledge base");
        }

        return examAccessService.listVisiblePracticeExamsByKnowledgeFolder(restaurantId, userId, isManager, folderId, includeInactive)
                .stream()
                .map(this::toDtoWithSourcesAndVisibility)
                .toList();
    }

    @Override
    @Transactional
    public TrainingExamDto createExam(Long restaurantId, CreateTrainingExamRequest request) {
        validateCertificationVisibility(request.mode(), request.visibilityPositionIds());
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
        assignmentSyncService.syncForExam(exam);
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

        // UpdateTrainingExamRequest uses full-replace semantics for visibility collections.
        // For certification exams null/empty means "clear visibility", which is invalid.
        validateCertificationVisibility(request.mode(), request.visibilityPositionIds());
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
        assignmentSyncService.syncForExam(exam);
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
        assignmentSyncService.syncForExam(exam);
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
    public void resetCertificationExamCycle(Long restaurantId, Long examId) {
        var exam = exams.findByIdAndRestaurantId(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
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
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));

        if (!exam.isActive()) {
            throw new ConflictException("Экзамен скрыт. Нельзя начать прохождение.");
        }

        examAccessService.ensureCanStartExam(exam, restaurantId, userId, isManager);

        TrainingExamAssignment assignment = null;
        if (exam.getMode() == TrainingExamMode.CERTIFICATION) {
            assignment = certificationAssignmentService.resolveForStart(exam, restaurantId, userId);
        }

        var existingAttemptOpt = attempts
                .findTopByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNullOrderByStartedAtDescIdDesc(
                        examId, restaurantId, userId, exam.getVersion());
        if (existingAttemptOpt.isPresent()) {
            return resumeAttempt(exam, existingAttemptOpt.get());
        }

        if (exam.getMode() == TrainingExamMode.CERTIFICATION && assignment != null) {
            certificationAssignmentService.ensureAttemptsAvailable(assignment);
            certificationAssignmentService.markStarted(assignment);
        } else {
            enforceAttemptLimit(exam, restaurantId, userId);
        }

        var pool = questionPoolResolver.buildQuestionPool(restaurantId, exam);
        if (pool.isEmpty()) {
            throw new BadRequestException("No questions in exam scope");
        }

        var selectedQuestions = pickQuestionsForAttempt(pool, exam.getQuestionCount());
        var relationData = loadQuestionRelations(selectedQuestions);
        var attempt = createAttempt(exam, userId, assignment);
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

        var existingQuestions = attemptQuestions.findByAttemptId(attemptId);
        var answersByQuestionId = request.answers().stream()
                .collect(Collectors.toMap(SubmitAttemptAnswerDto::questionId, Function.identity(), (first, second) -> second));

        int correctAnswers = 0;
        for (var item : existingQuestions) {
            var snapshot = snapshotService.readSnapshot(item.getQuestionSnapshotJson());
            var answer = answersByQuestionId.get(snapshot.questionId());
            if (answer == null) {
                throw new BadRequestException("Missing answer for question " + snapshot.questionId());
            }

            attemptEvaluator.validateAnswerForType(answer.answerJson(), snapshot);
            item.setChosenAnswerJson(answer.answerJson());

            boolean correct = attemptEvaluator.isAnswerCorrect(answer.answerJson(), item.getCorrectKeyJson(), snapshot.type());
            item.setCorrect(correct);
            if (correct) {
                correctAnswers++;
            }
        }

        int scorePercent = existingQuestions.isEmpty()
                ? 0
                : (int) Math.round((correctAnswers * 100.0) / existingQuestions.size());

        attempt.setFinishedAt(TimeProvider.now());
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

    @Override
    public void resetEmployeeCertificationAttempts(Long restaurantId, Long examId, Long userId) {
        certificationManagerActionService.resetAttemptsForEmployee(restaurantId, examId, userId);
    }

    @Override
    public void grantEmployeeCertificationExtraAttempts(Long restaurantId, Long examId, Long userId, Integer amount) {
        certificationManagerActionService.grantExtraAttemptForEmployee(restaurantId, examId, userId, amount);
    }

    @Override
    public CertificationExamSummaryDto getCertificationExamSummary(Long restaurantId, Long examId) {
        return certificationAnalyticsService.getExamSummary(restaurantId, examId);
    }

    @Override
    public List<CertificationExamPositionBreakdownDto> getCertificationExamPositionBreakdown(Long restaurantId, Long examId) {
        return certificationAnalyticsService.getPositionBreakdown(restaurantId, examId);
    }

    @Override
    public List<CertificationExamEmployeeRowDto> getCertificationExamEmployeeTable(Long restaurantId, Long examId) {
        return certificationAnalyticsService.getEmployeeRows(restaurantId, examId);
    }

    @Override
    public List<CertificationExamAttemptHistoryDto> getCertificationEmployeeAttemptHistory(Long restaurantId, Long examId, Long userId) {
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

    private void enforceAttemptLimit(TrainingExam exam, Long restaurantId, Long userId) {
        if (exam.getAttemptLimit() == null) {
            return;
        }

        long usedAttempts = attempts.countByExamIdAndRestaurantIdAndUserIdAndExamVersionAndFinishedAtIsNotNull(
                exam.getId(),
                restaurantId,
                userId,
                exam.getVersion()
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

    private TrainingExamAttempt createAttempt(TrainingExam exam, Long userId, TrainingExamAssignment assignment) {
        return attempts.save(TrainingExamAttempt.builder()
                .exam(exam)
                .examVersion(exam.getVersion())
                .restaurant(exam.getRestaurant())
                .assignment(assignment)
                .user(User.builder().id(userId).build())
                .startedAt(TimeProvider.now())
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

    private void replaceSources(Long restaurantId, TrainingExam exam, List<ExamSourceFolderDto> foldersDto, List<Long> sourceQuestionIds) {
        sourceFolders.deleteByExamId(exam.getId());
        sourceQuestions.deleteByExamId(exam.getId());

        var folderEntities = new ArrayList<TrainingExamSourceFolder>();
        for (var folderSource : (foldersDto == null ? List.<ExamSourceFolderDto>of() : foldersDto).stream().distinct().toList()) {
            var folder = folders.findByIdAndRestaurantId(folderSource.folderId(), restaurantId)
                    .orElseThrow(() -> new NotFoundException("Folder not found"));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
                throw new BadRequestException("Exam scope accepts only QUESTION_BANK folders");
            }
            if (folderSource.pickMode() == TrainingExamSourcePickMode.RANDOM
                    && (folderSource.randomCount() == null || folderSource.randomCount() < 1)) {
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
            var question = questions.findByIdAndRestaurantId(questionId, restaurantId)
                    .orElseThrow(() -> new NotFoundException("Question not found"));
            questionEntities.add(TrainingExamSourceQuestion.builder().exam(exam).question(question).build());
        }
        if (!questionEntities.isEmpty()) {
            sourceQuestions.saveAll(questionEntities);
        }
    }

    private void replaceVisibility(Long restaurantId, TrainingExam exam, List<Long> visibilityPositionIds) {
        exam.getVisibilityPositions().clear();
        if (visibilityPositionIds == null || visibilityPositionIds.isEmpty()) {
            return;
        }

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

    private void validateCertificationVisibility(TrainingExamMode mode, List<Long> visibilityPositionIds) {
        if (mode == TrainingExamMode.CERTIFICATION
                && (visibilityPositionIds == null || visibilityPositionIds.isEmpty())) {
            throw new BadRequestException("Для аттестации нужно указать хотя бы одну visibility-позицию (update работает как полный replace).");
        }
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

    private record QuestionRelations(
            Map<Long, List<TrainingQuestionOption>> optionsByQuestion,
            Map<Long, List<TrainingQuestionMatchPair>> pairsByQuestion,
            Map<Long, List<TrainingQuestionBlank>> blanksByQuestion,
            Map<Long, List<TrainingQuestionBlankOption>> blankOptionsByBlank
    ) {
    }
}
