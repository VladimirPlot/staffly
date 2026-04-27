package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.dao.DataIntegrityViolationException;
import jakarta.persistence.EntityManager;
import jakarta.persistence.PersistenceContext;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamNotificationStateRepository;

import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
public class TrainingCertificationNotificationService {
    private static final List<Integer> MILESTONES = List.of(30, 60, 90, 100);

    private final InboxMessageService inboxMessageService;
    private final RestaurantMemberRepository memberRepository;
    private final TrainingExamAssignmentRepository assignmentRepository;
    private final TrainingExamNotificationStateRepository notificationStateRepository;
    private final TrainingPolicyService trainingPolicyService;
    @PersistenceContext
    private EntityManager entityManager;

    @Transactional
    public void ensureStateExistsForExam(TrainingExam exam) {
        if (exam == null || exam.getId() == null || exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }
        if (notificationStateRepository.existsById(exam.getId())) {
            return;
        }
        try {
            notificationStateRepository.saveAndFlush(TrainingExamNotificationState.builder()
                    .exam(exam)
                    .lastCompletedMilestone(0)
                    .build());
        } catch (DataIntegrityViolationException ignoredConcurrentCreate) {
            // Another transaction created state first.
        }
    }

    @Transactional
    public void resetMilestoneStateForExam(TrainingExam exam) {
        if (exam == null || exam.getId() == null || exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }
        var state = getOrCreateStateForUpdate(exam);
        state.setLastCompletedMilestone(0);
        notificationStateRepository.save(state);
    }

    @Transactional
    public void notifyAssignmentsCreated(TrainingExam exam, List<TrainingExamAssignment> createdAssignments) {
        if (exam == null || exam.getMode() != TrainingExamMode.CERTIFICATION || !exam.isActive()) {
            return;
        }
        if (createdAssignments == null || createdAssignments.isEmpty()) {
            return;
        }

        Set<Long> userIds = createdAssignments.stream()
                .map(assignment -> assignment.getUser() == null ? null : assignment.getUser().getId())
                .filter(Objects::nonNull)
                .collect(Collectors.toSet());
        if (userIds.isEmpty()) {
            return;
        }

        Map<Long, RestaurantMember> membersByUserId = memberRepository
                .findByRestaurantIdAndUserIdIn(exam.getRestaurant().getId(), userIds)
                .stream()
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity(), (first, second) -> first));

        for (var assignment : createdAssignments) {
            if (!assignment.isActive()) {
                continue;
            }
            Long assignmentUserId = assignment.getUser() == null ? null : assignment.getUser().getId();
            if (assignmentUserId == null) {
                continue;
            }
            var member = membersByUserId.get(assignmentUserId);
            if (member == null) {
                log.warn("Cannot send assignment notification: member not found (restaurantId={}, examId={}, assignmentId={}, userId={})",
                        exam.getRestaurant().getId(), exam.getId(), assignment.getId(), assignmentUserId);
                continue;
            }
            String meta = "certification:assigned:" + exam.getId() + ":" + assignment.getId();
            String content = "Вам назначили аттестацию «" + resolveExamTitle(exam, assignment) + "»";
            try {
                var creator = resolveCreator(exam, member);
                inboxMessageService.createEvent(
                        exam.getRestaurant(),
                        creator,
                        content,
                        InboxEventSubtype.CERTIFICATION,
                        meta,
                        List.of(member),
                        null
                );
            } catch (Exception ex) {
                log.warn("Failed to send certification assignment notification (restaurantId={}, examId={}, assignmentId={})",
                        exam.getRestaurant().getId(), exam.getId(), assignment.getId(), ex);
            }
        }
    }

    @Transactional
    public void notifyUserResultOnSubmit(TrainingExamAttempt attempt) {
        if (attempt == null || attempt.getExam() == null || attempt.getExam().getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }

        var exam = attempt.getExam();
        Long userId = attempt.getUser() == null ? null : attempt.getUser().getId();
        if (userId == null) {
            return;
        }

        var memberOpt = memberRepository.findByUserIdAndRestaurantId(userId, exam.getRestaurant().getId());
        if (memberOpt.isEmpty()) {
            log.warn("Cannot send certification result notification: member not found (restaurantId={}, examId={}, attemptId={}, userId={})",
                    exam.getRestaurant().getId(), exam.getId(), attempt.getId(), userId);
            return;
        }

        Integer score = attempt.getScorePercent() == null ? 0 : attempt.getScorePercent();
        String content = Boolean.TRUE.equals(attempt.getPassed())
                ? "Вы сдали аттестацию «" + attempt.getTitleSnapshot() + "» на " + score + "%"
                : "Вы не сдали аттестацию «" + attempt.getTitleSnapshot() + "». Результат: " + score + "%";

        try {
            var recipient = memberOpt.get();
            var creator = resolveCreator(exam, recipient);
            inboxMessageService.createEvent(
                    exam.getRestaurant(),
                    creator,
                    content,
                    InboxEventSubtype.CERTIFICATION,
                    "certification:result:" + attempt.getId(),
                    List.of(recipient),
                    null
            );
        } catch (Exception ex) {
            log.warn("Failed to send certification result notification (restaurantId={}, examId={}, attemptId={})",
                    exam.getRestaurant().getId(), exam.getId(), attempt.getId(), ex);
        }
    }

    @Transactional
    public void notifyOwnerMilestoneOnSubmit(TrainingExamAttempt attempt) {
        if (attempt == null || attempt.getExam() == null || attempt.getExam().getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }

        var exam = attempt.getExam();
        Long examId = exam.getId();
        Long restaurantId = exam.getRestaurant().getId();
        // Ensure aggregate counts include assignment status just finalized in this transaction.
        entityManager.flush();

        long total = assignmentRepository.countByExamIdAndRestaurantIdAndActiveTrue(examId, restaurantId);
        if (total <= 0) {
            return;
        }

        long completed = assignmentRepository.countByExamIdAndRestaurantIdAndActiveTrueAndStatusIn(
                examId,
                restaurantId,
                List.of(TrainingExamAssignmentStatus.PASSED, TrainingExamAssignmentStatus.FAILED)
        );

        int percent = (int) ((completed * 100) / total);
        var state = getOrCreateStateForUpdate(exam);

        int highestCrossedMilestone = MILESTONES.stream()
                .filter(milestone -> milestone > state.getLastCompletedMilestone() && percent >= milestone)
                .max(Integer::compareTo)
                .orElse(0);
        if (highestCrossedMilestone == 0) {
            return;
        }

        boolean notificationAccepted = false;
        try {
            var ownerRecipient = resolveOwnerRecipient(exam);
            if (ownerRecipient == null) {
                log.warn("Cannot send certification milestone notification: no eligible recipient (restaurantId={}, examId={}, milestone={})",
                        restaurantId, examId, highestCrossedMilestone);
                notificationAccepted = true;
            } else {
                String content = "Аттестация «" + exam.getTitle() + "»: завершено " + percent + "% сотрудников ("
                        + completed + "/" + total + ")";
                var creator = resolveCreator(exam, ownerRecipient);
                inboxMessageService.createEvent(
                        exam.getRestaurant(),
                        creator,
                        content,
                        InboxEventSubtype.CERTIFICATION,
                        "certification:milestone:" + examId + ":" + highestCrossedMilestone,
                        List.of(ownerRecipient),
                        null
                );
                notificationAccepted = true;
            }
        } catch (Exception ex) {
            log.warn("Failed to send certification milestone notification (restaurantId={}, examId={}, milestone={})",
                    restaurantId, examId, highestCrossedMilestone, ex);
        }
        if (notificationAccepted) {
            // We advance milestone state only when inbox accepted the event (or when no recipient exists).
            // This keeps retries possible on transient notification failures without emitting duplicates:
            // inbox event meta is idempotent (restaurant_id + type + meta unique key).
            state.setLastCompletedMilestone(highestCrossedMilestone);
            notificationStateRepository.save(state);
        }
    }

    private RestaurantMember resolveOwnerRecipient(TrainingExam exam) {
        Long restaurantId = exam.getRestaurant().getId();
        Long ownerUserId = exam.getOwner() == null ? null : exam.getOwner().getId();

        if (ownerUserId != null) {
            var ownerMember = memberRepository.findWithUserByUserIdAndRestaurantId(ownerUserId, restaurantId).orElse(null);
            if (ownerMember != null && canManageTraining(ownerUserId, restaurantId)) {
                return ownerMember;
            }
        }

        var restaurantMembers = memberRepository.findWithUserByRestaurantId(restaurantId).stream()
                .sorted(Comparator.comparing(RestaurantMember::getId))
                .toList();
        var admin = restaurantMembers.stream().filter(member -> member.getRole() == RestaurantRole.ADMIN).findFirst();
        if (admin.isPresent()) {
            return admin.get();
        }
        return restaurantMembers.stream().filter(member -> member.getRole() == RestaurantRole.MANAGER).findFirst().orElse(null);
    }

    private boolean canManageTraining(Long userId, Long restaurantId) {
        try {
            return trainingPolicyService.canManageTraining(userId, restaurantId);
        } catch (RuntimeException ex) {
            return false;
        }
    }

    private String resolveExamTitle(TrainingExam exam, TrainingExamAssignment assignment) {
        if (exam.getTitle() != null && !exam.getTitle().isBlank()) {
            return exam.getTitle();
        }
        if (assignment.getExam() != null && assignment.getExam().getTitle() != null && !assignment.getExam().getTitle().isBlank()) {
            return assignment.getExam().getTitle();
        }
        return "аттестация";
    }

    private ru.staffly.user.model.User resolveCreator(TrainingExam exam, RestaurantMember fallbackRecipient) {
        if (exam.getOwner() != null) {
            return exam.getOwner();
        }
        if (exam.getCreatedBy() != null) {
            return exam.getCreatedBy();
        }
        return fallbackRecipient == null ? null : fallbackRecipient.getUser();
    }

    private TrainingExamNotificationState getOrCreateStateForUpdate(TrainingExam exam) {
        Long examId = exam.getId();
        var existing = notificationStateRepository.findByExamIdForUpdate(examId);
        if (existing.isPresent()) {
            return existing.get();
        }
        try {
            notificationStateRepository.saveAndFlush(TrainingExamNotificationState.builder()
                    .exam(exam)
                    .lastCompletedMilestone(0)
                    .build());
        } catch (DataIntegrityViolationException ignoredConcurrentCreate) {
            // Created by concurrent submit or by exam initialization in another transaction.
        }
        return notificationStateRepository.findByExamIdForUpdate(examId)
                .orElseThrow(() -> new IllegalStateException("Failed to resolve certification notification state for exam " + examId));
    }
}