package ru.staffly.training.service;

import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.model.TrainingFolder;

import java.util.*;

final class ExamFolderVisibilityWarnings {
    private ExamFolderVisibilityWarnings() {}

    static List<String> build(TrainingExamMode mode, TrainingFolder folder, List<Position> audience) {
        if (folder == null) return List.of();
        // Certification containers describe the assessed role, not employee visibility.
        if (mode == TrainingExamMode.CERTIFICATION && folder.getTargetRole() != null) return List.of();
        var restrictions = new ArrayList<Set<Long>>();
        var visited = new HashSet<Long>();
        for (var current = folder; current != null; current = current.getParent()) {
            if (current.getId() != null && !visited.add(current.getId())) {
                throw new BadRequestException("Обнаружена некорректная иерархия папок.");
            }
            var ids = new HashSet<Long>();
            current.getVisibilityPositions().forEach(position -> ids.add(position.getId()));
            if (!ids.isEmpty()) restrictions.add(ids);
        }
        var excludedNames = audience.stream()
                .filter(position -> restrictions.stream().anyMatch(ids -> !ids.contains(position.getId())))
                .map(Position::getName).distinct().sorted().toList();
        if (excludedNames.isEmpty()) return List.of();
        String message = "Аудитория теста шире настроенной видимости папки «" + folder.getName()
                + "»: " + String.join(", ", excludedNames) + ". Эти должности не входят в видимость этой папки или её родителей. "
                + "Вы можете в любой момент перенести тест в папку с подходящей видимостью.";
        if (mode == TrainingExamMode.CERTIFICATION) {
            message += " Назначенная аттестация остаётся доступной сотрудникам в личном списке: её аудитория не меняется.";
        }
        return List.of(message);
    }
}
