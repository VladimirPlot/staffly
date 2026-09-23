package ru.staffly.training.service;

import org.junit.jupiter.api.Test;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import ru.staffly.training.dto.CertificationAudienceEffectType;
import ru.staffly.training.dto.CertificationAudienceSyncResult;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.repository.TrainingExamRepository;

import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.*;

class CertificationAudienceSyncServiceTest {
    @Test
    void returnsAllFourAuthoritativeEffectsOnlyForRequestedSubject() {
        TrainingExamRepository exams = mock(TrainingExamRepository.class);
        CertificationAssignmentService assignments = mock(CertificationAssignmentService.class);
        TrainingCertificationNotificationService notifications = mock(TrainingCertificationNotificationService.class);
        CertificationAudienceSyncService service = new CertificationAudienceSyncService(exams, assignments, notifications);
        Restaurant restaurant = Restaurant.builder().id(1L).build();
        TrainingExam first = TrainingExam.builder().id(11L).restaurant(restaurant).build();
        TrainingExam second = TrainingExam.builder().id(12L).restaurant(restaurant).build();
        when(exams.findActiveCertificationByRestaurantIdWithVisibility(1L)).thenReturn(List.of(first, second));
        when(exams.findByIdAndRestaurantIdForUpdate(11L, 1L)).thenReturn(Optional.of(first));
        when(exams.findByIdAndRestaurantIdForUpdate(12L, 1L)).thenReturn(Optional.of(second));
        var created = effect(11L, 7L, CertificationAudienceEffectType.CREATED);
        var otherUser = effect(11L, 8L, CertificationAudienceEffectType.REACTIVATED);
        var reactivated = effect(12L, 7L, CertificationAudienceEffectType.REACTIVATED);
        var unchanged = new AppliedCertificationAudienceEffect(
                12L, "Certification 12", 20L, 7L, CertificationAudienceEffectType.UNCHANGED);
        var removed = effect(13L, 7L, CertificationAudienceEffectType.AUDIENCE_REMOVED);
        when(assignments.syncAudienceAssignmentsWithEffects(first))
                .thenReturn(new CertificationAudienceSyncResult(List.of(), List.of(created, otherUser)));
        when(assignments.syncAudienceAssignmentsWithEffects(second))
                .thenReturn(new CertificationAudienceSyncResult(List.of(), List.of(reactivated, unchanged, removed)));

        assertThat(service.syncRestaurantAudience(1L, 7L))
                .containsExactly(created, reactivated, unchanged, removed);
    }

    private AppliedCertificationAudienceEffect effect(Long examId, Long userId,
                                                       CertificationAudienceEffectType type) {
        return new AppliedCertificationAudienceEffect(
                examId, "Certification " + examId, 20L, userId, type);
    }
}
