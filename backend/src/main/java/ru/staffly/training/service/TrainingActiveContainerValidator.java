package ru.staffly.training.service;

import org.springframework.stereotype.Component;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.training.model.TrainingFolder;

import java.util.HashSet;

@Component
class TrainingActiveContainerValidator {

    void requireActiveChain(TrainingFolder folder) {
        var visited = new HashSet<Long>();
        for (var current = folder; current != null; current = current.getParent()) {
            if (!current.isActive()) {
                throw new BadRequestException(
                        "Объект находится в скрытой папке или под скрытым родителем. Сначала восстановите родительскую папку."
                );
            }
            if (current.getId() != null && !visited.add(current.getId())) {
                throw new BadRequestException("Обнаружена некорректная иерархия папок.");
            }
        }
    }
}
