package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ConflictException;
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
    private final CertificationAssessmentSpecificationService specificationService;
    private final EntityManager entityManager;

    @Transactional
    public TrainingExamAssignment resolveForStart(TrainingExam exam, Long restaurantId, Long userId) {
        var specification = specificationService.requireCurrent(exam);
        var assignment = assignments.findActiveForStartUpdate(
                        exam.getId(), restaurantId, userId, exam.getVersion(), specification.getId())
                .orElseThrow(() -> new ConflictException("Для вас нет активного назначения на текущий цикл аттестации."));
        return assignment;
    }

    @Transactional(readOnly = true)
    public Optional<TrainingExamAssignment> findActiveForExamAndUser(Long examId, Long restaurantId, Long userId) {
        return assignments.findCurrentActiveByExamAndUser(examId, restaurantId, userId);
    }

    @Transactional
    public List<TrainingExamAssignment> syncAudienceAssignments(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return List.of();
        }

        if (!exam.isActive()) {
            archiveAllActiveAssignments(exam);
            return List.of();
        }

        var audience = resolveAudienceMembers(exam);
        var audienceUserIds = audience.stream().map(member -> member.getUser().getId()).collect(Collectors.toSet());

        // One ordered lock query makes archive/reactivation a mutation-safe batch.
        var cycleAssignments = assignments.findCurrentVersionForLifecycleUpdate(
                exam.getId(), exam.getRestaurant().getId(), exam.getVersion());
        var cycleByUserId = cycleAssignments.stream()
                .collect(Collectors.toMap(
                        a -> a.getUser().getId(),
                        Function.identity(),
                        this::preferCurrentGeneration));

        var createdAssignments = new java.util.ArrayList<TrainingExamAssignment>();
        for (var member : audience) {
            var existing = cycleByUserId.get(member.getUser().getId());
            if (existing == null) {
                createdAssignments.add(assignments.save(createAssignment(exam, member)));
                continue;
            }
            reactivateLatestCurrentGeneration(exam, existing, member);
        }

        for (var assignment : cycleByUserId.values()) {
            if (assignment.isActive() && !audienceUserIds.contains(assignment.getUser().getId())) {
                assignment.setActive(false);
                assignment.setStatus(TrainingExamAssignmentStatus.ARCHIVED);
            }
        }
        return createdAssignments;
    }

    private void archiveAllActiveAssignments(TrainingExam exam) {
        var currentAssignments = assignments.findCurrentVersionForLifecycleUpdate(
                exam.getId(), exam.getRestaurant().getId(), exam.getVersion());
        var latestByUser = currentAssignments.stream().collect(Collectors.toMap(
                assignment -> assignment.getUser().getId(),
                Function.identity(),
                this::preferCurrentGeneration));
        for (var assignment : latestByUser.values()) {
            if (!assignment.isActive()) {
                continue;
            }
            assignment.setActive(false);
            assignment.setStatus(TrainingExamAssignmentStatus.ARCHIVED);
        }
    }

    @Transactional
    public List<TrainingExamAssignment> createAssignmentsForNewCycle(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return List.of();
        }

        var specification = specificationService.requireCurrent(exam);
        var activeAssignments = assignments.findAllActiveAssignmentsForCycleTransition(
                exam.getId(), exam.getRestaurant().getId());
        for (var assignment : activeAssignments) {
            assignment.setActive(false);
        }
        if (!exam.isActive()) {
            return List.of();
        }
        return resolveAudienceMembers(exam).stream()
                .map(member -> assignments.save(createAssignment(exam, member, specification)))
                .toList();
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

    public boolean shouldRevealCorrectAnswers(TrainingExamAssignment assignment, boolean passed) {
        if (assignment == null) {
            return false;
        }
        Integer allowed = calculateAttemptsAllowed(assignment);
        boolean attemptsRemain = allowed == null || assignment.getAttemptsUsed() < allowed;
        return passed || assignment.getPassedAt() != null || !attemptsRemain;
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

        boolean archived = assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED;
        assignment.setAttemptsUsed(assignment.getAttemptsUsed() + 1);
        assignment.setLastAttemptAt(attempt.getFinishedAt());

        if (attempt.getScorePercent() != null && (assignment.getBestScore() == null || attempt.getScorePercent() > assignment.getBestScore())) {
            assignment.setBestScore(attempt.getScorePercent());
        }

        if (Boolean.TRUE.equals(attempt.getPassed())) {
            if (assignment.getPassedAt() == null) {
                assignment.setPassedAt(attempt.getFinishedAt());
            }
            if (!archived) assignment.setStatus(TrainingExamAssignmentStatus.PASSED);
            return;
        }

        Integer allowed = calculateAttemptsAllowed(assignment);
        if (allowed != null && assignment.getAttemptsUsed() >= allowed) {
            if (!archived) assignment.setStatus(TrainingExamAssignmentStatus.EXHAUSTED);
        } else {
            if (!archived) assignment.setStatus(TrainingExamAssignmentStatus.FAILED);
        }
    }

    public void reconcileDerivedStateFromFinishedAttempts(TrainingExamAssignment assignment) {
        var finishedAttempts = attempts.findByAssignmentIdAndExamVersionAndFinishedAtIsNotNullOrderByFinishedAtDescIdDesc(
                assignment.getId(),
                assignment.getExamVersionSnapshot()
        );
        reconcileDerivedStateFromFinishedAttempts(assignment, finishedAttempts);
    }

    // Batch callers may preload the same canonical attempt set without changing the formula.
    public void reconcileDerivedStateFromFinishedAttempts(TrainingExamAssignment assignment,
                                                           List<TrainingExamAttempt> finishedAttempts) {
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

    /**
     * Derives status from canonical assignment fields after finished-attempt reconciliation.
     * ARCHIVED is the only persisted enum value with independent lifecycle meaning.
     */
    public void refreshStatus(TrainingExamAssignment assignment, boolean hasActiveUnfinishedAttempt) {
        if (assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED) {
            return;
        }
        if (assignment.getPassedAt() != null) {
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
        var assignment = lockCurrentForMutation(restaurantId, examId, userId);
        validateAudienceAndState(assignment, true);

        var memberPosition = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .map(RestaurantMember::getPosition)
                .orElse(assignment.getAssignedPosition());
        int nextGeneration = assignment.getResetGeneration() + 1;
        assignment.setActive(false);
        // Force the partial active-row uniqueness transition before inserting its successor.
        assignments.flush();
        assignments.save(TrainingExamAssignment.builder()
                .exam(assignment.getExam())
                .restaurant(assignment.getRestaurant())
                .user(assignment.getUser())
                .assignedPosition(memberPosition)
                .assessmentSpecification(assignment.getAssessmentSpecification())
                .attemptsLimitSnapshot(assignment.getAttemptsLimitSnapshot())
                .examVersionSnapshot(assignment.getExamVersionSnapshot())
                .resetGeneration(nextGeneration)
                .extraAttempts(0)
                .attemptsUsed(0)
                .status(TrainingExamAssignmentStatus.ASSIGNED)
                .active(true)
                .build());
    }

    @Transactional
    public void reopenByGrantingExtraAttempts(Long restaurantId, Long examId, Long userId, int amount) {
        var assignment = lockCurrentForMutation(restaurantId, examId, userId);
        validateAudienceAndState(assignment, false);
        assignment.setExtraAttempts(assignment.getExtraAttempts() + amount);
        reconcileDerivedStateFromFinishedAttempts(assignment);
        refreshStatus(assignment, false);
    }

    private void validateAudienceAndState(TrainingExamAssignment assignment, boolean reset) {
        boolean unfinished = attempts.existsByAssignmentIdAndFinishedAtIsNull(assignment.getId());
        reconcileDerivedStateFromFinishedAttempts(assignment);
        refreshStatus(assignment, unfinished);
        if (unfinished) {
            throw new ConflictException(reset
                    ? "Нельзя сбросить попытки, пока сотрудник проходит аттестацию."
                    : "Нельзя выдать дополнительную попытку, пока сотрудник проходит аттестацию.");
        }
        boolean inAudience = resolveAudienceMembers(assignment.getExam()).stream()
                .anyMatch(member -> member.getUser().getId().equals(assignment.getUser().getId()));
        if (!inAudience) {
            throw new ConflictException("Сотрудник больше не входит в аудиторию аттестации.");
        }
        var status = assignment.getStatus();
        boolean allowed = reset
                ? status == TrainingExamAssignmentStatus.PASSED || status == TrainingExamAssignmentStatus.FAILED
                    || status == TrainingExamAssignmentStatus.EXHAUSTED
                : status == TrainingExamAssignmentStatus.FAILED || status == TrainingExamAssignmentStatus.EXHAUSTED;
        if (!allowed) {
            throw new ConflictException(reset
                    ? "Сброс недоступен для текущего состояния назначения."
                    : "Дополнительная попытка доступна только после неудачной аттестации.");
        }
    }

    private TrainingExamAssignment lockCurrentForMutation(Long restaurantId, Long examId, Long userId) {
        var assignment = assignments.findCurrentActiveForMutation(examId, restaurantId, userId)
                .orElseThrow(() -> new ConflictException("Назначение уже изменилось, обновите данные."));
        entityManager.refresh(assignment);

        var exam = assignment.getExam();
        var specification = assignment.getAssessmentSpecification();
        boolean exactCurrent = assignment.isActive()
                && assignment.getExamVersionSnapshot() == exam.getVersion()
                && specification.getVersion() == assignment.getExamVersionSnapshot()
                && specification.getExam().getId().equals(exam.getId());
        int maxGeneration = assignments.findMaxResetGeneration(
                examId, userId, assignment.getExamVersionSnapshot());
        if (!exactCurrent || maxGeneration != assignment.getResetGeneration()) {
            throw new ConflictException("Назначение уже изменилось, обновите данные.");
        }
        return assignment;
    }

    /** The sole ARCHIVED -> active lifecycle transition for an existing current-version row. */
    private void reactivateLatestCurrentGeneration(TrainingExam exam,
                                                   TrainingExamAssignment assignment,
                                                   RestaurantMember member) {
        if (assignment.getExamVersionSnapshot() != exam.getVersion()
                || assignment.getAssessmentSpecification().getVersion() != exam.getVersion()
                || !assignment.getAssessmentSpecification().getExam().getId().equals(exam.getId())) {
            throw new ConflictException("Назначение не соответствует текущей версии аттестации.");
        }
        assignment.setAssignedPosition(member.getPosition());
        if (!assignment.isActive() || assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED) {
            assignment.setActive(true);
            // Temporarily leave ARCHIVED so canonical status may be derived; snapshots/history remain untouched.
            assignment.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
            reconcileDerivedStateFromFinishedAttempts(assignment);
            refreshStatus(assignment, attempts.existsByAssignmentIdAndFinishedAtIsNull(assignment.getId()));
        }
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
        return createAssignment(exam, member, specificationService.requireCurrent(exam));
    }

    private TrainingExamAssignment createAssignment(TrainingExam exam,
                                                    RestaurantMember member,
                                                    CertificationAssessmentSpecification specification) {
        return TrainingExamAssignment.builder()
                .exam(exam)
                .restaurant(exam.getRestaurant())
                .user(member.getUser())
                .assignedPosition(member.getPosition())
                .assessmentSpecification(specification)
                .attemptsLimitSnapshot(specification.getAttemptLimit())
                .examVersionSnapshot(specification.getVersion())
                .status(TrainingExamAssignmentStatus.ASSIGNED)
                .active(true)
                .build();
    }

    private TrainingExamAssignment preferCurrentGeneration(TrainingExamAssignment first,
                                                            TrainingExamAssignment second) {
        // Reactivation always targets max generation, never an older active/history row.
        return first.getResetGeneration() >= second.getResetGeneration() ? first : second;
    }
}
