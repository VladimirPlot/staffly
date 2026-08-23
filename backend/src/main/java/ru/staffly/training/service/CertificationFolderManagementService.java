package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.training.dto.CertificationContainerCapabilitiesDto;
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

    @Transactional(readOnly = true)
    public Set<Long> manageableFolderIds(Long restaurantId, Long userId) {
        var scopes = policy.certificationManagementScopes(userId, restaurantId);
        return manageableFolderIds(restaurantId, scopes.folderPositionIds(), scopes.targetPositionIds());
    }

    private Set<Long> manageableFolderIds(Long restaurantId,
                                          Set<Long> allowedFolderPositions,
                                          Set<Long> allowedExamTargets) {
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
            isManageable(folder, children, examsByFolder, memo, allowedFolderPositions, allowedExamTargets);
        }
        return memo.entrySet().stream().filter(Map.Entry::getValue).map(Map.Entry::getKey).collect(Collectors.toSet());
    }

    public void assertSubtreeManageable(Long restaurantId, Long userId, Long folderId) {
        if (!manageableFolderIds(restaurantId, userId).contains(folderId)) {
            throw new ForbiddenException(FORBIDDEN);
        }
    }

    /** Calculates reorder preconditions from physical active siblings, never from actor-filtered navigation lists. */
    @Transactional(readOnly = true)
    public CertificationContainerCapabilitiesDto containerCapabilities(Long restaurantId, Long userId, Long folderId) {
        var scopes = policy.certificationManagementScopes(userId, restaurantId);
        var allowedFolderPositions = scopes.folderPositionIds();
        var allowedExamTargets = scopes.targetPositionIds();
        var manageableFolderIds = manageableFolderIds(restaurantId, allowedFolderPositions, allowedExamTargets);

        if (folderId != null) {
            var current = folders.findByIdAndRestaurantId(folderId).orElse(null);
            if (current == null || current.getType() != TrainingFolderType.CERTIFICATION
                    || !current.isActive() || !manageableFolderIds.contains(folderId)) {
                return new CertificationContainerCapabilitiesDto(false, false);
            }
        }

        var directFolders = folders.findActiveInParent(
                restaurantId, TrainingFolderType.CERTIFICATION, folderId);
        boolean folderReorderAllowed = directFolders.stream()
                .allMatch(folder -> manageableFolderIds.contains(folder.getId()));

        var directExams = folderId == null
                ? exams.findActiveCertificationInRootWithVisibility(restaurantId)
                : exams.findActiveCertificationInFolderWithVisibility(restaurantId, folderId);
        boolean examReorderAllowed = directExams.stream().allMatch(exam -> {
            var targets = exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
            return !targets.isEmpty() && allowedExamTargets.containsAll(targets);
        });

        return new CertificationContainerCapabilitiesDto(folderReorderAllowed, examReorderAllowed);
    }

    private boolean isManageable(TrainingFolder folder,
                                  Map<Long, List<TrainingFolder>> children,
                                  Map<Long, List<ru.staffly.training.model.TrainingExam>> examsByFolder,
                                  Map<Long, Boolean> memo,
                                  Set<Long> allowedFolderPositions,
                                  Set<Long> allowedExamTargets) {
        var cached = memo.get(folder.getId());
        if (cached != null) return cached;
        var visibility = folder.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
        boolean manageable = (visibility.isEmpty() || allowedFolderPositions.containsAll(visibility))
                && examsByFolder.getOrDefault(folder.getId(), List.of()).stream().allMatch(exam -> {
                    var targets = exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
                    return !targets.isEmpty() && allowedExamTargets.containsAll(targets);
                })
                && children.getOrDefault(folder.getId(), List.of()).stream().allMatch(child ->
                    isManageable(child, children, examsByFolder, memo, allowedFolderPositions, allowedExamTargets));
        memo.put(folder.getId(), manageable);
        return manageable;
    }
}
