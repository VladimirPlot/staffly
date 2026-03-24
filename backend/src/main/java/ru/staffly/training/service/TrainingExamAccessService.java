package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.repository.RestaurantMemberRepository;
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

    List<TrainingExam> listVisibleExams(Long restaurantId,
                                        Long userId,
                                        boolean isManager,
                                        boolean includeInactive,
                                        TrainingExamMode modeFilter) {
        if (isManager) {
            var examList = includeInactive
                    ? exams.findByRestaurantIdWithVisibilityOrderByCreatedAtDesc(restaurantId)
                    : exams.findByRestaurantIdAndActiveTrueWithVisibilityOrderByCreatedAtDesc(restaurantId);
            if (modeFilter == null) {
                return examList;
            }
            return examList.stream().filter(exam -> exam.getMode() == modeFilter).toList();
        }

        Long positionId = requireMemberPositionId(restaurantId, userId);
        return exams.listVisibleForStaff(restaurantId, positionId, modeFilter);
    }

    List<Long> listVisibleCertificationExamIdsForUser(Long restaurantId, Long userId) {
        return listVisibleExams(restaurantId, userId, false, false, TrainingExamMode.CERTIFICATION)
                .stream()
                .map(TrainingExam::getId)
                .toList();
    }

    void ensureCanStartExam(TrainingExam exam, Long restaurantId, Long userId, boolean isManager) {
        if (isManager || exam.getVisibilityPositions().isEmpty()) {
            return;
        }

        Long positionId = requireMemberPositionId(restaurantId, userId);
        boolean visible = exam.getVisibilityPositions().stream()
                .anyMatch(position -> Objects.equals(position.getId(), positionId));
        if (!visible) {
            throw new ConflictException("Экзамен недоступен для вашей должности.");
        }
    }

    private Long requireMemberPositionId(Long restaurantId, Long userId) {
        var member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Membership not found"));
        return member.getPosition() == null ? -1L : member.getPosition().getId();
    }
}
