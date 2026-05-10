package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.repository.TrainingExamRepository;

@Service
@RequiredArgsConstructor
@Slf4j
public class CertificationAudienceSyncService {
    private final TrainingExamRepository exams;
    private final CertificationAssignmentService assignmentService;
    private final TrainingCertificationNotificationService trainingCertificationNotificationService;

    @Transactional
    public void syncExamAudience(TrainingExam exam) {
        var createdAssignments = assignmentService.syncAudienceAssignments(exam);
        try {
            trainingCertificationNotificationService.notifyAssignmentsCreated(exam, createdAssignments);
        } catch (Exception ex) {
            log.warn("Failed to notify certification audience sync (restaurantId={}, examId={})",
                    exam.getRestaurant().getId(), exam.getId(), ex);
        }
    }

    @Transactional
    public void syncRestaurantAudience(Long restaurantId) {
        var activeCertificationExams = exams.findActiveCertificationByRestaurantIdWithVisibility(restaurantId);
        for (var exam : activeCertificationExams) {
            var createdAssignments = assignmentService.syncAudienceAssignments(exam);
            try {
                trainingCertificationNotificationService.notifyAssignmentsCreated(exam, createdAssignments);
            } catch (Exception ex) {
                log.warn("Failed to notify certification audience sync (restaurantId={}, examId={})",
                        exam.getRestaurant().getId(), exam.getId(), ex);
            }
        }
    }
}