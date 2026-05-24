package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamSourceFolderRepository;
import ru.staffly.training.repository.TrainingExamSourceQuestionRepository;
import ru.staffly.training.repository.TrainingQuestionRepository;

import java.util.*;

@Component
@RequiredArgsConstructor
class ExamQuestionPoolResolver {
    private final TrainingExamSourceFolderRepository sourceFolders;
    private final TrainingExamSourceQuestionRepository sourceQuestions;
    private final TrainingQuestionRepository questions;

    List<TrainingQuestion> buildQuestionPool(Long restaurantId, TrainingExam exam) {
        TrainingQuestionGroup group = questionGroupForMode(exam.getMode());
        var uniqueById = new LinkedHashMap<Long, TrainingQuestion>();

        addFolderQuestionsToPool(restaurantId, exam, group, uniqueById);
        addExplicitQuestionsToPool(restaurantId, exam, group, uniqueById);

        return new ArrayList<>(uniqueById.values());
    }

    private void addFolderQuestionsToPool(Long restaurantId,
                                          TrainingExam exam,
                                          TrainingQuestionGroup group,
                                          Map<Long, TrainingQuestion> uniqueById) {
        var folderSourcesList = sourceFolders.findByExamId(exam.getId());
        for (var source : folderSourcesList) {
            var folderQuestions = questions.findActiveByRestaurantIdAndFolderIdAndQuestionGroup(
                    restaurantId,
                    source.getFolder().getId(),
                    group
            );

            var selected = applyFolderPickMode(source, folderQuestions);
            for (var question : selected) {
                uniqueById.put(question.getId(), question);
            }
        }
    }

    private List<TrainingQuestion> applyFolderPickMode(TrainingExamSourceFolder source, List<TrainingQuestion> folderQuestions) {
        if (source.getPickMode() != TrainingExamSourcePickMode.RANDOM) {
            return folderQuestions;
        }
        var mutable = new ArrayList<>(folderQuestions);
        Collections.shuffle(mutable);
        int take = Math.min(source.getRandomCount() == null ? 0 : source.getRandomCount(), mutable.size());
        return mutable.subList(0, take);
    }

    private void addExplicitQuestionsToPool(Long restaurantId,
                                            TrainingExam exam,
                                            TrainingQuestionGroup group,
                                            Map<Long, TrainingQuestion> uniqueById) {
        var questionIds = sourceQuestions.findByExamId(exam.getId()).stream()
                .map(sourceQuestion -> sourceQuestion.getQuestion().getId())
                .distinct()
                .toList();
        if (questionIds.isEmpty()) {
            return;
        }

        var explicitQuestions = questions.findActiveByRestaurantIdAndIdIn(restaurantId, questionIds).stream()
                .filter(question -> question.getQuestionGroup() == group)
                .toList();
        for (var question : explicitQuestions) {
            uniqueById.put(question.getId(), question);
        }
    }

    private TrainingQuestionGroup questionGroupForMode(TrainingExamMode mode) {
        return mode == TrainingExamMode.PRACTICE
                ? TrainingQuestionGroup.PRACTICE
                : TrainingQuestionGroup.CERTIFICATION;
    }
}
