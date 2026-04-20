package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.repository.TrainingExamRepository;

@Service
@RequiredArgsConstructor
public class CertificationAudienceSyncService {
    private final TrainingExamRepository exams;
    private final CertificationAssignmentService assignmentService;

    @Transactional
    public void syncExamAudience(TrainingExam exam) {
        assignmentService.syncAudienceAssignments(exam);
    }

    @Transactional
    public void syncRestaurantAudience(Long restaurantId) {
        var activeCertificationExams = exams.findActiveCertificationByRestaurantIdWithVisibility(restaurantId);
        for (var exam : activeCertificationExams) {
            assignmentService.syncAudienceAssignments(exam);
        }
    }
}