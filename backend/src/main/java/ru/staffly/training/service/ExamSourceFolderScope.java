package ru.staffly.training.service;

import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.model.TrainingFolder;

import java.util.*;

/** Direct scopes are disjoint; recursive scopes must not overlap other folder scopes. */
class ExamSourceFolderScope {
    List<TrainingFolder> resolve(TrainingFolder root, boolean includeDescendants,
                                List<TrainingFolder> bank) {
        if (!includeDescendants) return List.of(root);
        var children = new HashMap<Long, List<TrainingFolder>>();
        for (var folder : bank) {
            if (folder.getParent() != null) children.computeIfAbsent(folder.getParent().getId(), ignored -> new ArrayList<>()).add(folder);
        }
        var result = new ArrayList<TrainingFolder>();
        var queue = new ArrayDeque<TrainingFolder>();
        var visited = new HashSet<Long>();
        queue.add(root);
        while (!queue.isEmpty()) {
            var folder = queue.remove();
            if (!visited.add(folder.getId())) throw new BadRequestException("В структуре папок обнаружен цикл.");
            if (!folder.isActive()) continue; // A separately hidden branch stays excluded.
            result.add(folder);
            queue.addAll(children.getOrDefault(folder.getId(), List.of()));
        }
        return result;
    }

    void assertDisjoint(List<Set<Long>> scopes) {
        var seen = new HashSet<Long>();
        for (var scope : scopes) for (var id : scope) {
            if (!seen.add(id)) throw new BadRequestException("Области выбранных папок пересекаются. Уберите вложенный источник или отключите включение подпапок.");
        }
    }
}
