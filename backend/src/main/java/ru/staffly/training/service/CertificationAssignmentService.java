package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
class CertificationAssignmentService {
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingExamAttemptRepository attempts;
    private final RestaurantMemberRepository members;

    @Transactional
    public TrainingExamAssignment resolveForStart(TrainingExam exam, Long restaurantId, Long userId) {
        return assignments.findActiveForStartUpdate(exam.getId(), restaurantId, userId)
                .orElseThrow(() -> new ConflictException("Для вас нет активного назначения на эту аттестацию."));
    }

    @Transactional(readOnly = true)
    public Optional<TrainingExamAssignment> findActiveForExamAndUser(Long examId, Long restaurantId, Long userId) {
        return assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(examId, restaurantId, userId);
    }

    @Transactional
    public void syncAudienceAssignments(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }

        if (!exam.isActive()) {
            archiveAllActiveAssignments(exam);
            return;
        }

        var audience = resolveAudienceMembers(exam);
        var audienceUserIds = audience.stream().map(member -> member.getUser().getId()).collect(Collectors.toSet());

        var activeAssignments = assignments.findByExamIdAndRestaurantIdAndActiveTrue(exam.getId(), exam.getRestaurant().getId());
        var activeByUserId = activeAssignments.stream()
                .collect(Collectors.toMap(a -> a.getUser().getId(), Function.identity(), (first, second) -> first));

        for (var member : audience) {
            var existing = activeByUserId.get(member.getUser().getId());
            if (existing == null) {
                assignments.save(createAssignment(exam, member));
                continue;
            }
            existing.setAssignedPosition(member.getPosition());
        }

        for (var assignment : activeAssignments) {
            if (!audienceUserIds.contains(assignment.getUser().getId())) {
                assignment.setActive(false);
                assignment.setStatus(TrainingExamAssignmentStatus.ARCHIVED);
            }
        }
    }

    private void archiveAllActiveAssignments(TrainingExam exam) {
        var activeAssignments = assignments.findByExamIdAndRestaurantIdAndActiveTrue(exam.getId(), exam.getRestaurant().getId());
        for (var assignment : activeAssignments) {
            assignment.setActive(false);
            assignment.setStatus(TrainingExamAssignmentStatus.ARCHIVED);
        }
    }

    @Transactional
    public void resetAssignmentsForNewCycle(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }

        var activeAssignments = assignments.findByExamIdAndRestaurantIdAndActiveTrue(exam.getId(), exam.getRestaurant().getId());
        for (var assignment : activeAssignments) {
            assignment.setAttemptsLimitSnapshot(exam.getAttemptLimit());
            assignment.setExamVersionSnapshot(exam.getVersion());
            assignment.setExtraAttempts(0);
            assignment.setAttemptsUsed(0);
            assignment.setBestScore(null);
            assignment.setLastAttemptAt(null);
            assignment.setPassedAt(null);
            assignment.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
        }
    }

    public void ensureAttemptsAvailable(TrainingExamAssignment assignment) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.PASSED || assignment.getPassedAt() != null) {
            throw new ConflictException("Аттестация уже успешно пройдена. Повторная попытка недоступна.");
        }
        Integer allowed = calculateAttemptsAllowed(assignment);
        if (allowed != null && assignment.getAttemptsUsed() >= allowed) {
            throw new ConflictException("Лимит попыток по назначенной аттестации исчерпан.");
        }
    }

    public void markStarted(TrainingExamAssignment assignment) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.PASSED) {
            return;
        }
        assignment.setStatus(TrainingExamAssignmentStatus.IN_PROGRESS);
    }

    public void updateOnSubmit(TrainingExamAttempt attempt) {
        var assignment = attempt.getAssignment();
        if (assignment == null) {
            return;
        }

        assignment.setAttemptsUsed(assignment.getAttemptsUsed() + 1);
        assignment.setLastAttemptAt(attempt.getFinishedAt());

        if (attempt.getScorePercent() != null && (assignment.getBestScore() == null || attempt.getScorePercent() > assignment.getBestScore())) {
            assignment.setBestScore(attempt.getScorePercent());
        }

        if (Boolean.TRUE.equals(attempt.getPassed())) {
            if (assignment.getPassedAt() == null) {
                assignment.setPassedAt(attempt.getFinishedAt());
            }
            assignment.setStatus(TrainingExamAssignmentStatus.PASSED);
            return;
        }

        Integer allowed = calculateAttemptsAllowed(assignment);
        if (allowed != null && assignment.getAttemptsUsed() >= allowed) {
            assignment.setStatus(TrainingExamAssignmentStatus.EXHAUSTED);
        } else {
            assignment.setStatus(TrainingExamAssignmentStatus.FAILED);
        }
    }

    public void reconcileDerivedStateFromFinishedAttempts(TrainingExamAssignment assignment) {
        var finishedAttempts = attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(
                assignment.getId(),
                assignment.getExamVersionSnapshot()
        );
        assignment.setAttemptsUsed(finishedAttempts.size());
        assignment.setLastAttemptAt(finishedAttempts.stream()
                .map(TrainingExamAttempt::getFinishedAt)
                .filter(item -> item != null)
                .max(Comparator.naturalOrder())
                .orElse(null));
        assignment.setBestScore(finishedAttempts.stream()
                .map(TrainingExamAttempt::getScorePercent)
                .filter(item -> item != null)
                .max(Integer::compareTo)
                .orElse(null));
        assignment.setPassedAt(finishedAttempts.stream()
                .filter(item -> Boolean.TRUE.equals(item.getPassed()))
                .map(TrainingExamAttempt::getFinishedAt)
                .filter(item -> item != null)
                .min(Instant::compareTo)
                .orElse(null));
    }

    public void refreshStatus(TrainingExamAssignment assignment, boolean hasActiveUnfinishedAttempt) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED) {
            return;
        }
        if (assignment.getPassedAt() != null || assignment.getStatus() == TrainingExamAssignmentStatus.PASSED) {
            assignment.setStatus(TrainingExamAssignmentStatus.PASSED);
            return;
        }
        if (hasActiveUnfinishedAttempt) {
            assignment.setStatus(TrainingExamAssignmentStatus.IN_PROGRESS);
            return;
        }

        Integer attemptsAllowed = calculateAttemptsAllowed(assignment);
        if (attemptsAllowed != null && assignment.getAttemptsUsed() >= attemptsAllowed) {
            assignment.setStatus(TrainingExamAssignmentStatus.EXHAUSTED);
            return;
        }

        assignment.setStatus(assignment.getAttemptsUsed() > 0
                ? TrainingExamAssignmentStatus.FAILED
                : TrainingExamAssignmentStatus.ASSIGNED);
    }

    @Transactional
    public void fullResetEmployeeAttempts(Long restaurantId, Long examId, Long userId) {
        var assignment = assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(examId, restaurantId, userId)
                .orElseThrow(() -> new NotFoundException("Assignment not found"));
        assignment.setActive(false);
        assignment.setStatus(TrainingExamAssignmentStatus.ARCHIVED);

        var memberPosition = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .map(RestaurantMember::getPosition)
                .orElse(null);
        var assignedPosition = memberPosition != null ? memberPosition : assignment.getAssignedPosition();
        assignments.save(TrainingExamAssignment.builder()
                .exam(assignment.getExam())
                .restaurant(assignment.getRestaurant())
                .user(assignment.getUser())
                .assignedPosition(assignedPosition)
                .attemptsLimitSnapshot(assignment.getExam().getAttemptLimit())
                .examVersionSnapshot(assignment.getExam().getVersion())
                .extraAttempts(0)
                .attemptsUsed(0)
                .bestScore(null)
                .lastAttemptAt(null)
                .passedAt(null)
                .status(TrainingExamAssignmentStatus.ASSIGNED)
                .active(true)
                .build());
    }

    @Transactional
    public void reopenByGrantingExtraAttempts(Long restaurantId, Long examId, Long userId, int amount) {
        var assignment = assignments.findByExamIdAndRestaurantIdAndUserIdAndActiveTrue(examId, restaurantId, userId)
                .orElseThrow(() -> new NotFoundException("Assignment not found"));
        assignment.setExtraAttempts(assignment.getExtraAttempts() + amount);
        reconcileDerivedStateFromFinishedAttempts(assignment);
        if (assignment.getStatus() == TrainingExamAssignmentStatus.PASSED
                || assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED
                || assignment.getStatus() == TrainingExamAssignmentStatus.IN_PROGRESS) {
            return;
        }
        refreshStatus(assignment, false);
    }

    public Integer calculateAttemptsAllowed(TrainingExamAssignment assignment) {
        if (assignment.getAttemptsLimitSnapshot() == null) {
            return null;
        }
        return assignment.getAttemptsLimitSnapshot() + assignment.getExtraAttempts();
    }

    private List<RestaurantMember> resolveAudienceMembers(TrainingExam exam) {
        var allMembers = members.findWithUserAndPositionByRestaurantId(exam.getRestaurant().getId());
        var visibilityPositionIds = exam.getVisibilityPositions().stream().map(position -> position.getId()).collect(Collectors.toSet());
        if (visibilityPositionIds.isEmpty()) {
            return List.of();
        }
        return allMembers.stream()
                .filter(member -> member.getPosition() != null && visibilityPositionIds.contains(member.getPosition().getId()))
                .toList();
    }

    private TrainingExamAssignment createAssignment(TrainingExam exam, RestaurantMember member) {
        return TrainingExamAssignment.builder()
                .exam(exam)
                .restaurant(exam.getRestaurant())
                .user(member.getUser())
                .assignedPosition(member.getPosition())
                .attemptsLimitSnapshot(exam.getAttemptLimit())
                .examVersionSnapshot(exam.getVersion())
                .status(TrainingExamAssignmentStatus.ASSIGNED)
                .active(true)
                .build();
    }
}
