package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.repository.TrainingExamRepository;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;

import java.util.ArrayList;
import java.util.List;

@Service
@RequiredArgsConstructor
@Slf4j
public class CertificationAudienceSyncService {
    private final TrainingExamRepository exams;
    private final CertificationAssignmentService assignmentService;
    private final TrainingCertificationNotificationService trainingCertificationNotificationService;

    @Transactional
    public void syncExamAudience(TrainingExam exam) {
        var result = assignmentService.syncAudienceAssignmentsWithEffects(exam);
        try {
            trainingCertificationNotificationService.notifyAssignmentsCreated(exam, result.createdAssignments());
        } catch (Exception ex) {
            log.warn("Failed to notify certification audience sync (restaurantId={}, examId={})",
                    exam.getRestaurant().getId(), exam.getId(), ex);
        }
    }

    @Transactional
    public void syncRestaurantAudience(Long restaurantId) {
        syncRestaurantAudience(restaurantId, null);
    }

    /** Returns mutation-produced audience effects for one subject while still synchronizing the whole restaurant. */
    @Transactional
    public List<AppliedCertificationAudienceEffect> syncRestaurantAudience(Long restaurantId, Long subjectUserId) {
        var subjectEffects = new ArrayList<AppliedCertificationAudienceEffect>();
        var activeCertificationExams = exams.findActiveCertificationByRestaurantIdWithVisibility(restaurantId);
        for (var candidate : activeCertificationExams) {
            // Membership-wide sync joins the same exam -> ordered assignments lock order.
            var exam = exams.findByIdAndRestaurantIdForUpdate(candidate.getId(), restaurantId)
                    .orElseThrow();
            var result = assignmentService.syncAudienceAssignmentsWithEffects(exam);
            if (subjectUserId != null) {
                result.effects().stream()
                        .filter(effect -> subjectUserId.equals(effect.userId()))
                        .forEach(subjectEffects::add);
            }
            try {
                trainingCertificationNotificationService.notifyAssignmentsCreated(exam, result.createdAssignments());
            } catch (Exception ex) {
                log.warn("Failed to notify certification audience sync (restaurantId={}, examId={})",
                        exam.getRestaurant().getId(), exam.getId(), ex);
            }
        }
        return List.copyOf(subjectEffects);
    }
}
