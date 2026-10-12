package ru.staffly.training.service;

import com.fasterxml.jackson.core.type.TypeReference;
import com.fasterxml.jackson.databind.ObjectMapper;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.*;

import java.util.*;
import java.util.stream.Collectors;

/** Captures all candidates, so folder random selection remains random on each attempt. */
@Component
@RequiredArgsConstructor
class CertificationQuestionSnapshotService {
    private final TrainingExamSourceFolderRepository sourceFolders;
    private final TrainingExamSourceQuestionRepository sourceQuestions;
    private final TrainingQuestionRepository questions;
    private final TrainingQuestionOptionRepository options;
    private final TrainingQuestionMatchPairRepository pairs;
    private final TrainingQuestionBlankRepository blanks;
    private final TrainingQuestionBlankOptionRepository blankOptions;
    private final ExamSnapshotService snapshots;
    private final ObjectMapper mapper;
    private final EntityManager entityManager;
    private final TrainingFolderRepository bankFolders;

    String capture(TrainingExam exam) {
        var candidates = new TreeMap<Long, TrainingQuestion>();
        var restaurantId = exam.getRestaurant().getId();
        var selectedFolders = sourceFolders.findByExamId(exam.getId());
        var sourceMembership = new TreeMap<Long, Set<Long>>();
        for (var source : selectedFolders) {
            var scope = new ExamSourceFolderScope().resolve(source.getFolder(), source.isIncludeDescendants(),
                    source.isIncludeDescendants() ? bankFolders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(
                            restaurantId, TrainingFolderType.QUESTION_BANK) : List.of());
            for (var folder : scope) {
                sourceMembership.computeIfAbsent(folder.getId(), ignored -> new TreeSet<>()).add(source.getFolder().getId());
                questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(
                        restaurantId, folder.getId(), TrainingQuestionGroup.CERTIFICATION)
                        .forEach(question -> candidates.put(question.getId(), question));
            }
        }
        var ids = sourceQuestions.findByExamId(exam.getId()).stream()
                .map(source -> source.getQuestion().getId()).distinct().toList();
        if (!ids.isEmpty()) {
            questions.findActiveByRestaurantIdAndIdIn(restaurantId, ids).stream()
                    .filter(question -> question.getQuestionGroup() == TrainingQuestionGroup.CERTIFICATION)
                    .forEach(question -> candidates.put(question.getId(), question));
        }
        // Question edits acquire the corresponding write lock before changing nested answers.
        // Ordered read locks prevent mixed old prompts/new answer keys during publication.
        candidates.values().forEach(question -> {
            entityManager.lock(question, LockModeType.PESSIMISTIC_READ);
            entityManager.refresh(question);
        });
        var questionIds = new ArrayList<>(candidates.keySet());
        if (questionIds.isEmpty()) return "[]";
        var optionsByQuestion = options.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(option -> option.getQuestion().getId()));
        var pairsByQuestion = pairs.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(pair -> pair.getQuestion().getId()));
        var blanksByQuestion = blanks.findByQuestionIdInOrderBySortOrderAscIdAsc(questionIds).stream()
                .collect(Collectors.groupingBy(blank -> blank.getQuestion().getId()));
        var blankIds = blanksByQuestion.values().stream().flatMap(List::stream).map(TrainingQuestionBlank::getId).toList();
        var blankOptionsByBlank = blankIds.isEmpty() ? Map.<Long, List<TrainingQuestionBlankOption>>of()
                : blankOptions.findByBlankIdInOrderBySortOrderAscIdAsc(blankIds).stream()
                .collect(Collectors.groupingBy(option -> option.getBlank().getId()));
        return serialize(candidates.values().stream()
                .filter(question -> question.isActive() && question.getQuestionGroup() == TrainingQuestionGroup.CERTIFICATION)
                .filter(question -> ids.contains(question.getId()) || sourceMembership.containsKey(question.getFolder().getId()))
                .map(question -> {
            var payload = snapshots.buildSnapshot(question,
                    optionsByQuestion.getOrDefault(question.getId(), List.of()),
                    pairsByQuestion.getOrDefault(question.getId(), List.of()),
                    blanksByQuestion.getOrDefault(question.getId(), List.of()), blankOptionsByBlank);
            return new FrozenQuestion(question.getId(), question.getFolder().getId(),
                    payload.snapshotJson(), payload.correctKeyJson(),
                    new ArrayList<>(sourceMembership.getOrDefault(question.getFolder().getId(), Set.of())));
        }).toList());
    }

    List<FrozenQuestion> read(String json) {
        try {
            if (json == null) throw new IllegalStateException("Missing published question pool");
            return mapper.readValue(json, new TypeReference<List<FrozenQuestion>>() {});
        } catch (Exception exception) {
            throw new IllegalStateException("Invalid published question pool", exception);
        }
    }

    boolean sameContent(String left, String right) {
        try {
            // Compare parsed nested JSON too: SQL backfill and Jackson use different whitespace/key order.
            var first = normalize(read(left));
            var second = normalize(read(right));
            return first.equals(second);
        } catch (Exception exception) {
            throw new IllegalStateException("Cannot compare published question pools", exception);
        }
    }

    private Map<Long, Object> normalize(List<FrozenQuestion> pool) throws Exception {
        var result = new TreeMap<Long, Object>();
        for (var question : pool) {
            result.put(question.questionId(), List.of(question.folderId(),
                    question.sourceFolderIds() == null || question.sourceFolderIds().isEmpty()
                            ? List.of(question.folderId()) : question.sourceFolderIds(),
                    mapper.readTree(question.snapshotJson()), mapper.readTree(question.correctKeyJson())));
        }
        return result;
    }

    private String serialize(List<FrozenQuestion> pool) {
        try { return mapper.writeValueAsString(pool); }
        catch (Exception exception) { throw new IllegalStateException("Cannot freeze question pool", exception); }
    }

    record FrozenQuestion(Long questionId, Long folderId, String snapshotJson, String correctKeyJson,
                          List<Long> sourceFolderIds) {
        boolean belongsTo(Long sourceId) {
            return sourceFolderIds == null ? Objects.equals(folderId, sourceId) : sourceFolderIds.contains(sourceId);
        }
    }
}
