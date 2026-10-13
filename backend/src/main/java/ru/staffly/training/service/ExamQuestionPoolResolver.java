package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.training.dto.ExamSourceFolderDto;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamSourceFolderRepository;
import ru.staffly.training.repository.TrainingExamSourceQuestionRepository;
import ru.staffly.training.repository.TrainingFolderRepository;
import ru.staffly.training.repository.TrainingQuestionRepository;

import java.util.*;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
class ExamQuestionPoolResolver {
    private final TrainingExamSourceFolderRepository sourceFolders;
    private final TrainingExamSourceQuestionRepository sourceQuestions;
    private final TrainingQuestionRepository questions;
    private final TrainingFolderRepository folders;
    private final TrainingPolicyService trainingPolicyService;
    private final TrainingActiveContainerValidator activeContainerValidator;
    private final CertificationQuestionSnapshotService questionSnapshots;

    List<TrainingFolder> scopeFolders(Long restaurantId, TrainingFolder root, boolean includeDescendants) {
        return new ExamSourceFolderScope().resolve(root, includeDescendants, includeDescendants
                ? folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(restaurantId, TrainingFolderType.QUESTION_BANK)
                : List.of());
    }

    List<TrainingQuestion> folderCandidates(Long restaurantId, TrainingFolder root, boolean includeDescendants,
                                           TrainingQuestionGroup group) {
        return scopeFolders(restaurantId, root, includeDescendants).stream()
                .flatMap(folder -> questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(restaurantId, folder.getId(), group).stream())
                .toList();
    }

    int resolveAvailableQuestionCount(Long restaurantId,
                                      Long userId,
                                      TrainingExamMode mode,
                                      List<ExamSourceFolderDto> folderSources,
                                      List<Long> explicitQuestionIds) {
        var group = questionGroupForMode(mode);
        var explicitQuestions = resolveAndValidateExplicitQuestions(
                restaurantId, userId, group, explicitQuestionIds);
        var selections = new ArrayList<FolderSelection>();
        var scopes = new ArrayList<Set<Long>>();

        for (var source : normalizeFolderSources(folderSources)) {
            var folder = folders.findByIdAndRestaurantIdWithVisibility(source.folderId(), restaurantId)
                    .orElseThrow(() -> new BadRequestException(
                            "Выбранная папка вопросов больше недоступна. Удалите или замените её."));
            if (folder.getType() != TrainingFolderType.QUESTION_BANK) {
                throw new BadRequestException("Источником может быть только папка Банка вопросов.");
            }
            activeContainerValidator.requireActiveChain(folder);
            trainingPolicyService.assertCanAccessManagementFolder(userId, restaurantId, folder);

            var scope = scopeFolders(restaurantId, folder, source.includeDescendants());
            for (var included : scope) {
                activeContainerValidator.requireActiveChain(included);
                trainingPolicyService.assertCanAccessManagementFolder(userId, restaurantId, included);
            }
            scopes.add(scope.stream().map(TrainingFolder::getId).collect(Collectors.toSet()));
            var folderQuestions = scope.stream().flatMap(included -> questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(
                    restaurantId, included.getId(), group).stream()).toList();
            validateFolderSelection(folder.getName(), source.pickMode(), source.randomCount(),
                    folderQuestions, explicitQuestions);
            selections.add(new FolderSelection(source.pickMode(), source.randomCount(), folderQuestions));
        }

        new ExamSourceFolderScope().assertDisjoint(scopes);
        var resolved = assembleQuestionPool(selections, explicitQuestions);
        if (resolved.questions().isEmpty()) {
            throw new BadRequestException("Добавьте хотя бы один доступный вопрос.");
        }
        return resolved.questions().size();
    }

    ResolvedQuestionPool buildQuestionPool(Long restaurantId, TrainingExam exam) {
        var group = questionGroupForMode(exam.getMode());
        var explicitIds = sourceQuestions.findByExamId(exam.getId()).stream()
                .map(sourceQuestion -> sourceQuestion.getQuestion().getId())
                .distinct()
                .toList();
        var explicitQuestions = explicitIds.isEmpty()
                ? List.<TrainingQuestion>of()
                : questions.findActiveByRestaurantIdAndIdIn(restaurantId, explicitIds).stream()
                        .filter(question -> question.getQuestionGroup() == group)
                        .toList();

        var selections = sourceFolders.findByExamId(exam.getId()).stream()
                .map(source -> new FolderSelection(
                        source.getPickMode(),
                        source.getRandomCount(),
                        folderCandidates(restaurantId, source.getFolder(), source.isIncludeDescendants(), group)))
                .toList();
        return assembleQuestionPool(selections, explicitQuestions);
    }

    ResolvedQuestionPool buildQuestionPool(Long restaurantId,
                                           CertificationAssessmentSpecification specification) {
        var frozen = questionSnapshots.read(specification.getQuestionPoolJson());
        var explicitIds = specification.getQuestionSources().stream()
                .map(CertificationAssessmentQuestionSource::getQuestionId).distinct().toList();
        var explicitQuestions = frozen.stream().filter(question -> explicitIds.contains(question.questionId()))
                .map(question -> TrainingQuestion.builder().id(question.questionId()).build()).toList();
        var selections = specification.getFolderSources().stream()
                .map(source -> new FolderSelection(source.getPickMode(), source.getRandomCount(),
                        frozen.stream().filter(question -> question.belongsTo(source.getFolderId()))
                                .map(question -> TrainingQuestion.builder().id(question.questionId()).build()).toList()))
                .toList();
        return assembleQuestionPool(selections, explicitQuestions);
    }

    private List<TrainingQuestion> resolveAndValidateExplicitQuestions(Long restaurantId,
                                                                        Long userId,
                                                                        TrainingQuestionGroup group,
                                                                        List<Long> explicitQuestionIds) {
        var resolved = new ArrayList<TrainingQuestion>();
        var ids = explicitQuestionIds == null
                ? List.<Long>of()
                : explicitQuestionIds.stream().filter(Objects::nonNull).distinct().toList();
        for (var questionId : ids) {
            var question = questions.findByIdAndRestaurantIdWithFolderVisibility(questionId, restaurantId)
                    .orElseThrow(() -> new BadRequestException(
                            "Выбранный вопрос больше недоступен. Удалите или замените его."));
            if (!question.isActive()) {
                throw new BadRequestException(
                        "Вопрос «" + question.getTitle() + "» скрыт. Удалите или замените его.");
            }
            if (question.getQuestionGroup() != group) {
                throw new BadRequestException(
                        "Вопрос «" + question.getTitle() + "» не относится к выбранному режиму теста.");
            }
            activeContainerValidator.requireActiveChain(question.getFolder());
            trainingPolicyService.assertCanAccessManagementFolder(userId, restaurantId, question.getFolder());
            resolved.add(question);
        }
        return resolved;
    }

    private void validateFolderSelection(String folderName,
                                         TrainingExamSourcePickMode pickMode,
                                         Integer randomCount,
                                         List<TrainingQuestion> folderQuestions,
                                         List<TrainingQuestion> explicitQuestions) {
        if (folderQuestions.isEmpty()) {
            throw new BadRequestException(
                    "Папка «" + folderName + "» не содержит доступных вопросов для выбранного режима.");
        }
        if (pickMode != TrainingExamSourcePickMode.RANDOM) {
            return;
        }
        if (randomCount == null || randomCount < 1) {
            throw new BadRequestException(
                    "Для случайной выборки из папки «" + folderName + "» укажите количество больше нуля.");
        }
        var explicitIds = explicitQuestions.stream().map(TrainingQuestion::getId).collect(Collectors.toSet());
        long availableCandidates = folderQuestions.stream()
                .filter(question -> !explicitIds.contains(question.getId()))
                .count();
        if (randomCount > availableCandidates) {
            throw new BadRequestException(
                    "В папке «" + folderName + "» доступно " + availableCandidates
                            + " дополнительных вопросов, поэтому случайно выбрать " + randomCount + " нельзя.");
        }
    }

    private ResolvedQuestionPool assembleQuestionPool(List<FolderSelection> selections,
                                                       List<TrainingQuestion> explicitQuestions) {
        var explicitIds = explicitQuestions.stream().map(TrainingQuestion::getId).collect(Collectors.toSet());
        var uniqueById = new LinkedHashMap<Long, TrainingQuestion>();

        for (var selection : selections) {
            if (selection.pickMode() == TrainingExamSourcePickMode.RANDOM) {
                var candidates = selection.questions().stream()
                        .filter(question -> !explicitIds.contains(question.getId()))
                        .collect(Collectors.toCollection(ArrayList::new));
                Collections.shuffle(candidates);
                int take = Math.min(selection.randomCount() == null ? 0 : selection.randomCount(), candidates.size());
                candidates.subList(0, take).forEach(question -> uniqueById.put(question.getId(), question));
            } else {
                selection.questions().forEach(question -> uniqueById.put(question.getId(), question));
            }
        }
        explicitQuestions.forEach(question -> uniqueById.put(question.getId(), question));
        return new ResolvedQuestionPool(new ArrayList<>(uniqueById.values()), explicitIds);
    }

    private List<ExamSourceFolderDto> normalizeFolderSources(List<ExamSourceFolderDto> sources) {
        var unique = new LinkedHashMap<Long, ExamSourceFolderDto>();
        for (var source : sources == null ? List.<ExamSourceFolderDto>of() : sources) {
            if (source == null || source.folderId() == null || source.pickMode() == null) {
                throw new BadRequestException("Некорректно задан источник вопросов.");
            }
            var previous = unique.putIfAbsent(source.folderId(), source);
            if (previous != null && (previous.pickMode() != source.pickMode()
                    || !Objects.equals(previous.randomCount(), source.randomCount())
                    || previous.includeDescendants() != source.includeDescendants())) {
                throw new BadRequestException("Одна папка выбрана несколько раз с разными настройками.");
            }
        }
        return List.copyOf(unique.values());
    }

    private TrainingQuestionGroup questionGroupForMode(TrainingExamMode mode) {
        return mode == TrainingExamMode.PRACTICE
                ? TrainingQuestionGroup.PRACTICE
                : TrainingQuestionGroup.CERTIFICATION;
    }

    private record FolderSelection(TrainingExamSourcePickMode pickMode,
                                   Integer randomCount,
                                   List<TrainingQuestion> questions) {}

    record ResolvedQuestionPool(List<TrainingQuestion> questions, Set<Long> mandatoryQuestionIds) {}
}
