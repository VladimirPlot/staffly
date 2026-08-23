package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.training.model.TrainingFolder;
import ru.staffly.training.model.TrainingFolderType;
import ru.staffly.training.repository.TrainingExamRepository;
import ru.staffly.training.repository.TrainingFolderRepository;

import java.util.*;
import java.util.stream.Collectors;

/** Computes mutation authority from the real, unfiltered certification tree. */
@Service
@RequiredArgsConstructor
public class CertificationFolderManagementService {
    private static final String FORBIDDEN = "Certification folder subtree is outside the actor management scope.";

    private final TrainingFolderRepository folders;
    private final TrainingExamRepository exams;
    private final TrainingPolicyService policy;

    public Set<Long> manageableFolderIds(Long restaurantId, Long userId) {
        var allFolders = folders.findByRestaurantIdAndTypeWithVisibilityOrderBySortOrderAscNameAsc(
                restaurantId, TrainingFolderType.CERTIFICATION);
        var children = allFolders.stream()
                .filter(folder -> folder.getParent() != null)
                .collect(Collectors.groupingBy(folder -> folder.getParent().getId()));
        var examsByFolder = exams.findCertificationByRestaurantIdWithFolderAndVisibility(restaurantId).stream()
                .filter(exam -> exam.getFolder() != null)
                .collect(Collectors.groupingBy(exam -> exam.getFolder().getId()));
        var memo = new HashMap<Long, Boolean>();
        for (var folder : allFolders) {
            isManageable(folder, userId, restaurantId, children, examsByFolder, memo);
        }
        return memo.entrySet().stream().filter(Map.Entry::getValue).map(Map.Entry::getKey).collect(Collectors.toSet());
    }

    public void assertSubtreeManageable(Long restaurantId, Long userId, Long folderId) {
        if (!manageableFolderIds(restaurantId, userId).contains(folderId)) {
            throw new ForbiddenException(FORBIDDEN);
        }
    }

    private boolean isManageable(TrainingFolder folder, Long userId, Long restaurantId,
                                  Map<Long, List<TrainingFolder>> children,
                                  Map<Long, List<ru.staffly.training.model.TrainingExam>> examsByFolder,
                                  Map<Long, Boolean> memo) {
        var cached = memo.get(folder.getId());
        if (cached != null) return cached;
        var visibility = folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
        boolean manageable = policy.canManageCertificationFolderOwnScope(userId, restaurantId, visibility)
                && examsByFolder.getOrDefault(folder.getId(), List.of()).stream().allMatch(exam ->
                    policy.canManageCertificationTargets(userId, restaurantId,
                            exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())))
                && children.getOrDefault(folder.getId(), List.of()).stream().allMatch(child ->
                    isManageable(child, userId, restaurantId, children, examsByFolder, memo));
        memo.put(folder.getId(), manageable);
        return manageable;
    }
}
