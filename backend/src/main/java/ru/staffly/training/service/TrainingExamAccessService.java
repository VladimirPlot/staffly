package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamRepository;

import java.util.List;
import java.util.Objects;

@Component
@RequiredArgsConstructor
class TrainingExamAccessService {
    private final TrainingExamRepository exams;
    private final RestaurantMemberRepository members;

    /**
     * Visibility = текущий уровень доступа к экзамену.
     * Это не assignment и не персональное назначение.
     *
     * В следующем этапе сюда будет добавляться assignment-aware слой поверх visibility,
     * но текущая логика намеренно остается только visibility-based.
     */
    List<TrainingExam> listVisibleExams(Long restaurantId,
                                        Long userId,
                                        boolean isManager,
                                        boolean includeInactive,
                                        TrainingExamMode modeFilter) {
        var context = resolveVisibilityContext(restaurantId, userId, isManager);
        return listVisibleExams(restaurantId, context, includeInactive, modeFilter);
    }

    List<Long> listVisiblePracticeExamIdsForUser(Long restaurantId, Long userId) {
        var context = resolveVisibilityContext(restaurantId, userId, null);
        return listVisibleExams(restaurantId, context, false, TrainingExamMode.PRACTICE)
                .stream()
                .map(TrainingExam::getId)
                .toList();
    }

    private List<TrainingExam> listVisibleExams(Long restaurantId,
                                                ExamVisibilityContext context,
                                                boolean includeInactive,
                                                TrainingExamMode modeFilter) {
        if (context.isManager()) {
            var examList = includeInactive
                    ? exams.findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(restaurantId)
                    : exams.findByRestaurantIdAndActiveTrueWithVisibilityOrderByCreatedAtDesc(restaurantId);
            if (modeFilter == null) {
                return examList;
            }
            return examList.stream().filter(exam -> exam.getMode() == modeFilter).toList();
        }

        return exams.listVisibleForStaff(restaurantId, context.positionId(), modeFilter);
    }

    List<TrainingExam> listVisiblePracticeExamsByKnowledgeFolder(Long restaurantId,
                                                                 Long userId,
                                                                 boolean isManager,
                                                                 Long folderId,
                                                                 boolean includeInactive) {
        var context = resolveVisibilityContext(restaurantId, userId, isManager);
        if (context.isManager()) {
            return exams.listPracticeByKnowledgeFolder(restaurantId, folderId, includeInactive, null);
        }
        return exams.listPracticeByKnowledgeFolder(restaurantId, folderId, false, context.positionId());
    }

    void ensureCanStartExam(TrainingExam exam, Long restaurantId, Long userId, boolean isManager) {
        var context = resolveVisibilityContext(restaurantId, userId, isManager);
        if (context.isManager() || exam.getVisibilityPositions().isEmpty()) {
            return;
        }

        Long positionId = context.positionId();
        boolean visible = exam.getVisibilityPositions().stream()
                .anyMatch(position -> Objects.equals(position.getId(), positionId));
        if (!visible) {
            throw new ConflictException("Экзамен недоступен для вашей должности.");
        }
    }

    private ExamVisibilityContext resolveVisibilityContext(Long restaurantId, Long userId, Boolean managerOverride) {
        var member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Not a member"));
        boolean memberIsManager = member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;
        boolean effectiveManager = managerOverride == null ? memberIsManager : managerOverride;
        return new ExamVisibilityContext(effectiveManager, member.getPosition() == null ? null : member.getPosition().getId());
    }

    private record ExamVisibilityContext(boolean isManager, Long positionId) {
    }
}
