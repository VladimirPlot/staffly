package ru.staffly.training.service;

import jakarta.persistence.EntityManager;
import lombok.RequiredArgsConstructor;
import lombok.extern.slf4j.Slf4j;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;
import ru.staffly.training.repository.TrainingExamAttemptRepository;
import ru.staffly.training.repository.CertificationAssignmentCycleRepository;

import java.time.Instant;
import java.util.Comparator;
import java.util.List;
import java.util.Optional;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Slf4j
class CertificationAssignmentService {
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingExamAttemptRepository attempts;
    private final RestaurantMemberRepository members;
    private final CertificationAssessmentSpecificationService specificationService;
    private final CertificationAssignmentCycleRepository cycles;
    private final EntityManager entityManager;

    @Transactional
    public TrainingExamAssignment resolveForStart(TrainingExam exam, Long restaurantId, Long userId) {
        var assignment = assignments.findActiveForStartUpdate(exam.getId(), restaurantId, userId)
                .orElseThrow(() -> new ConflictException("Для вас нет активного назначения аттестации."));
        validateAssignmentIdentity(assignment);
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
            deactivateAllActiveAssignmentsForHiddenExam(exam);
            syncHiddenAudienceAssignments(exam);
            return List.of();
        }

        var audience = resolveAudienceMembers(exam);
        var audienceUserIds = audience.stream().map(member -> member.getUser().getId()).collect(Collectors.toSet());

        // One ordered lock query makes deactivation/reactivation a mutation-safe batch.
        var cycleAssignments = assignments.findAllActiveAssignmentsForCycleTransition(
                exam.getId(), exam.getRestaurant().getId());
        var cycleByUserId = cycleAssignments.stream()
                .collect(Collectors.toMap(
                        a -> a.getUser().getId(),
                        Function.identity(),
                        this::preferCurrentGeneration));

        var createdAssignments = new java.util.ArrayList<TrainingExamAssignment>();
        for (var member : audience) {
            var existing = cycleByUserId.get(member.getUser().getId());
            if (existing == null) {
                var specification = specificationService.requireCurrent(exam);
                var cycle = requireCurrentAssignmentCycle(exam, specification);
                var inactive = assignments.findAudienceRemovedForExactCycle(
                        exam.getId(), exam.getRestaurant().getId(), member.getUser().getId(),
                        specification.getId(), cycle.getId());
                if (inactive.size() > 1) {
                    throw new ConflictException("Обнаружено несколько удалённых назначений сотрудника в текущем цикле.");
                }
                if (!inactive.isEmpty()) {
                    reactivateCurrentAudienceAssignment(inactive.get(0), member);
                } else {
                    createdAssignments.add(assignments.save(createAssignment(exam, member, specification, cycle)));
                }
                continue;
            }
            existing.setAssignedPosition(member.getPosition());
        }

        for (var assignment : cycleByUserId.values()) {
            if (assignment.isActive() && !audienceUserIds.contains(assignment.getUser().getId())) {
                assignment.setActive(false);
                assignment.setDeactivationReason(TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED);
            }
        }
        return createdAssignments;
    }

    private void deactivateAllActiveAssignmentsForHiddenExam(TrainingExam exam) {
        var currentAssignments = assignments.findAllActiveAssignmentsForCycleTransition(
                exam.getId(), exam.getRestaurant().getId());
        var latestByUser = currentAssignments.stream().collect(Collectors.toMap(
                assignment -> assignment.getUser().getId(),
                Function.identity(),
                this::preferCurrentGeneration));
        for (var assignment : latestByUser.values()) {
            if (!assignment.isActive()) {
                continue;
            }
            assignment.setActive(false);
            assignment.setDeactivationReason(TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN);
        }
    }

    /** Keeps audience lifecycle current while preserving the hidden employee-access overlay. */
    private void syncHiddenAudienceAssignments(TrainingExam exam) {
        var audience = resolveAudienceMembers(exam);
        var audienceByUser = audience.stream()
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity()));
        var hidden = assignments.findInactiveByDeactivationReasonForRestore(
                exam.getId(), exam.getRestaurant().getId(), TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN);
        var hiddenByUser = hidden.stream().collect(Collectors.toMap(
                assignment -> assignment.getUser().getId(),
                Function.identity(),
                this::preferCurrentGeneration));

        for (var assignment : hiddenByUser.values()) {
            var member = audienceByUser.get(assignment.getUser().getId());
            if (member == null) {
                assignment.setDeactivationReason(TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED);
            } else {
                assignment.setAssignedPosition(member.getPosition());
            }
        }

        var specification = specificationService.requireCurrent(exam);
        var cycle = requireCurrentAssignmentCycle(exam, specification);
        for (var member : audience) {
            if (hiddenByUser.containsKey(member.getUser().getId())) {
                continue;
            }
            var inactive = assignments.findAudienceRemovedForExactCycle(
                    exam.getId(), exam.getRestaurant().getId(), member.getUser().getId(),
                    specification.getId(), cycle.getId());
            if (inactive.size() > 1) {
                throw new ConflictException("Обнаружено несколько удалённых назначений сотрудника в текущем цикле.");
            }
            var assignment = inactive.isEmpty()
                    ? assignments.save(createAssignment(exam, member, specification, cycle))
                    : inactive.get(0);
            assignment.setAssignedPosition(member.getPosition());
            assignment.setActive(false);
            assignment.setDeactivationReason(TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN);
        }
    }

    /**
     * Restores the exact obligations paused by exam hide. This deliberately does not
     * share the version-aware AUDIENCE_REMOVED re-add path: hide is neither publication
     * nor re-certification, so assignment/specification/cycle/generation stay unchanged.
     */
    @Transactional
    public void restoreHiddenAudienceAssignments(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION || !exam.isActive()) {
            return;
        }
        var audienceByUser = resolveAudienceMembers(exam).stream()
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity()));
        var currentSpecification = specificationService.requireCurrent(exam);
        var currentCycle = requireCurrentAssignmentCycle(exam, currentSpecification);
        var hidden = assignments.findInactiveByDeactivationReasonForRestore(
                exam.getId(), exam.getRestaurant().getId(), TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN);
        var selectedByUser = new java.util.HashMap<Long, TrainingExamAssignment>();
        for (var assignment : hidden) {
            Long userId = assignment.getUser().getId();
            if (!audienceByUser.containsKey(userId)) {
                // The exam is visible again, so audience membership—not exam visibility—
                // is now the authoritative reason this obligation remains inactive.
                // Do not normalize status or touch attempts/history on this path.
                assignment.setDeactivationReason(TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED);
                continue;
            }
            boolean currentLifecycle = assignment.getAssessmentSpecification().getId().equals(currentSpecification.getId())
                    && assignment.getAssignmentCycle() != null
                    && assignment.getAssignmentCycle().getId().equals(currentCycle.getId());
            boolean gracefulHistorical = assignment.getPassedAt() != null
                    || attempts.existsByAssignmentIdAndFinishedAtIsNull(assignment.getId());
            if (assignment.getReplacedByAssignment() != null || (!currentLifecycle && !gracefulHistorical)) {
                assignment.setDeactivationReason(
                        assignment.getAssessmentSpecification().getVersion() < currentSpecification.getVersion()
                                ? TrainingExamAssignmentDeactivationReason.SUPERSEDED_BY_VERSION
                                : TrainingExamAssignmentDeactivationReason.RE_CERTIFICATION_CYCLE);
                continue;
            }
            if (selectedByUser.putIfAbsent(userId, assignment) != null) {
                throw new ConflictException("Обнаружено несколько скрытых назначений сотрудника для одной аттестации.");
            }
        }
        for (var assignment : selectedByUser.values().stream()
                .sorted(Comparator.comparing(TrainingExamAssignment::getId)).toList()) {
            validateAssignmentIdentity(assignment);
            assignment.setAssignedPosition(audienceByUser.get(assignment.getUser().getId()).getPosition());
            assignment.setActive(true);
            assignment.setDeactivationReason(null);
            // Legacy rows used ARCHIVED as a lifecycle overlay. New rows already retain
            // their business/result status, while old rows need a neutral derivation seed.
            if (assignment.getStatus() == TrainingExamAssignmentStatus.ARCHIVED) {
                assignment.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
            }
            reconcileDerivedStateFromFinishedAttempts(assignment);
            refreshStatus(assignment, attempts.existsByAssignmentIdAndFinishedAtIsNull(assignment.getId()));
        }
    }

    /** Starts a fresh obligation for every member without touching attempts or historical results. */
    @Transactional
    public List<TrainingExamAssignment> launchRecertificationCycle(
            TrainingExam exam,
            CertificationAssessmentSpecification specification,
            CertificationAssignmentCycle recertificationCycle) {
        var audience = resolveAudienceMembers(exam);
        if (audience.isEmpty()) {
            throw new ConflictException("Нет сотрудников для повторной аттестации.");
        }
        var membersByUser = audience.stream()
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity()));
        var candidates = assignments.findLifecyclePredecessorCandidatesForRecertification(
                exam.getId(), exam.getRestaurant().getId());
        var expectedCycle = cycles.findTopByExamIdAndCycleSequenceLessThanOrderByCycleSequenceDesc(
                        exam.getId(), recertificationCycle.getCycleSequence())
                .orElseThrow(() -> new ConflictException("Для повторной аттестации отсутствует текущий предыдущий цикл."));
        var candidateIds = candidates.stream().map(TrainingExamAssignment::getId).toList();
        var unfinishedAssignmentIds = (candidateIds.isEmpty() ? List.<TrainingExamAttempt>of()
                : attempts.findByAssignmentIdInAndFinishedAtIsNullOrderByAssignmentIdAscStartedAtDescIdDesc(candidateIds))
                .stream().filter(attempt -> attempt.getAssignment() != null
                        && attempt.getExam() != null
                        && attempt.getExam().getId().equals(attempt.getAssignment().getExam().getId())
                        && attempt.getExamVersion() == attempt.getAssignment().getExamVersionSnapshot())
                .map(attempt -> attempt.getAssignment().getId()).collect(Collectors.toSet());
        var predecessors = new java.util.ArrayList<TrainingExamAssignment>();
        for (var old : candidates) {
            var predecessorShape = classifyRecertificationPredecessor(
                    old, exam, specification, expectedCycle, recertificationCycle, unfinishedAssignmentIds);
            if (predecessorShape == RecertificationPredecessorShape.PROVABLY_STALE_HISTORICAL
                    && !old.isActive()
                    && old.getDeactivationReason() == TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN) {
                continue;
            }
            if (predecessorShape == RecertificationPredecessorShape.INVALID
                    || predecessorShape == RecertificationPredecessorShape.PROVABLY_STALE_HISTORICAL) {
                log.error("Rejecting re-certification due to invalid predecessor identity: assignmentId={}, examId={}, specificationId={}, cycleId={}, expectedSpecificationId={}, expectedCycleId={}, newCycleId={}, hasMatchingUnfinishedAttempt={}",
                        old.getId(), old.getExam() == null ? null : old.getExam().getId(),
                        old.getAssessmentSpecification() == null ? null : old.getAssessmentSpecification().getId(),
                        old.getAssignmentCycle() == null ? null : old.getAssignmentCycle().getId(),
                        specification.getId(), expectedCycle.getId(), recertificationCycle.getId(),
                        unfinishedAssignmentIds.contains(old.getId()));
                throw new ConflictException("Активное назначение имеет несогласованную идентичность текущего цикла.");
            }
            predecessors.add(old);
        }
        var predecessorByUser = new java.util.HashMap<Long, TrainingExamAssignment>();
        for (var old : predecessors) {
            var member = membersByUser.get(old.getUser().getId());
            old.setActive(false);
            if (member == null) {
                old.setDeactivationReason(TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED);
            } else {
                old.setDeactivationReason(TrainingExamAssignmentDeactivationReason.RE_CERTIFICATION_CYCLE);
                predecessorByUser.put(old.getUser().getId(), old);
            }
        }
        assignments.flush();

        var successors = new java.util.ArrayList<TrainingExamAssignment>();
        for (var member : audience) {
            var successor = assignments.save(createAssignment(exam, member, specification, recertificationCycle));
            if (!exam.isActive()) {
                successor.setActive(false);
                successor.setDeactivationReason(TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN);
            }
            var predecessor = predecessorByUser.get(member.getUser().getId());
            if (predecessor != null) {
                predecessor.setReplacedByAssignment(successor);
            }
            successors.add(successor);
        }
        return successors;
    }

    /** Publication runs under the exam lock and only migrates idle incomplete obligations. */
    @Transactional
    public List<TrainingExamAssignment> publishMaterialVersion(TrainingExam exam,
                                                               CertificationAssessmentSpecification specification,
                                                               CertificationAssignmentCycle publicationCycle) {
        // EXAM_HIDDEN is only an access overlay. Hidden obligations participate in
        // publication exactly like active ones; more specific transitions below replace
        // that temporary reason and therefore cannot be undone by restore.
        var active = assignments.findLifecycleObligationsForPublication(exam.getId(), exam.getRestaurant().getId());
        var audience = resolveAudienceMembers(exam);
        var membersByUser = audience.stream().collect(Collectors.toMap(m -> m.getUser().getId(), Function.identity()));
        var ids = active.stream().map(TrainingExamAssignment::getId).toList();
        var finished = ids.isEmpty() ? List.<TrainingExamAttempt>of()
                : attempts.findCountedFinishedByAssignmentIdIn(ids);
        var finishedByAssignment = finished.stream().collect(Collectors.groupingBy(a -> a.getAssignment().getId()));
        var unfinishedIds = (ids.isEmpty() ? List.<TrainingExamAttempt>of()
                : attempts.findByAssignmentIdInAndFinishedAtIsNullOrderByAssignmentIdAscStartedAtDescIdDesc(ids)).stream()
                .map(a -> a.getAssignment().getId()).collect(Collectors.toSet());
        var successors = new java.util.ArrayList<TrainingExamAssignment>();

        for (var old : active) {
            var member = membersByUser.get(old.getUser().getId());
            if (member == null) {
                old.setActive(false);
                old.setDeactivationReason(TrainingExamAssignmentDeactivationReason.AUDIENCE_REMOVED);
                continue;
            }
            validateAssignmentIdentity(old);
            reconcileDerivedStateFromFinishedAttempts(old, finishedByAssignment.getOrDefault(old.getId(), List.of()));
            boolean unfinished = unfinishedIds.contains(old.getId());
            if (old.getStatus() == TrainingExamAssignmentStatus.ARCHIVED) {
                // Legacy hidden rows used ARCHIVED as an overlay. Seed only those rows
                // before canonical derivation; current lifecycle rows retain business status.
                old.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
            }
            refreshStatus(old, unfinished);
            if (old.getPassedAt() != null || old.getStatus() == TrainingExamAssignmentStatus.PASSED || unfinished) {
                continue;
            }
            if (old.getStatus() != TrainingExamAssignmentStatus.ASSIGNED
                    && old.getStatus() != TrainingExamAssignmentStatus.FAILED
                    && old.getStatus() != TrainingExamAssignmentStatus.EXHAUSTED) {
                throw new ConflictException("Состояние назначения не позволяет опубликовать новую версию.");
            }
            old.setActive(false);
            old.setDeactivationReason(TrainingExamAssignmentDeactivationReason.SUPERSEDED_BY_VERSION);
            assignments.flush();
            var successor = assignments.save(createAssignment(exam, member, specification, publicationCycle));
            if (!exam.isActive()) {
                successor.setActive(false);
                successor.setDeactivationReason(TrainingExamAssignmentDeactivationReason.EXAM_HIDDEN);
            }
            old.setReplacedByAssignment(successor);
            successors.add(successor);
        }
        return successors;
    }

    public void ensureAttemptsAvailable(TrainingExamAssignment assignment) {
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

        // A passing result completes the obligation permanently. Later counted attempts
        // may improve bestScore, but a lower score cannot undo the first successful pass.
        if (assignment.getPassedAt() != null) {
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
        var finishedAttempts = attempts.findCountedFinishedByAssignmentAndVersion(
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
     * ARCHIVED is retained unchanged as an unknown legacy lifecycle state.
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
        var latestSpecification = specificationService.requireCurrent(assignment.getExam());
        var currentCycle = requireCurrentAssignmentCycle(assignment.getExam(), latestSpecification);
        boolean migrateCycle = !assignment.getAssessmentSpecification().getId().equals(latestSpecification.getId())
                || assignment.getAssignmentCycle() == null
                || !assignment.getAssignmentCycle().getId().equals(currentCycle.getId());
        int nextGeneration = migrateCycle ? 0 : assignment.getResetGeneration() + 1;
        var targetCycle = migrateCycle ? currentCycle : assignment.getAssignmentCycle();
        assignment.setActive(false);
        assignment.setDeactivationReason(TrainingExamAssignmentDeactivationReason.USER_RESET);
        // Force the partial active-row uniqueness transition before inserting its successor.
        assignments.flush();
        var successor = assignments.save(TrainingExamAssignment.builder()
                .exam(assignment.getExam())
                .restaurant(assignment.getRestaurant())
                .user(assignment.getUser())
                .assignedPosition(memberPosition)
                .assessmentSpecification(migrateCycle ? latestSpecification : assignment.getAssessmentSpecification())
                .assignmentCycle(targetCycle)
                .attemptsLimitSnapshot(migrateCycle ? latestSpecification.getAttemptLimit() : assignment.getAttemptsLimitSnapshot())
                .examVersionSnapshot(migrateCycle ? latestSpecification.getVersion() : assignment.getExamVersionSnapshot())
                .resetGeneration(nextGeneration)
                .extraAttempts(0)
                .attemptsUsed(0)
                .status(TrainingExamAssignmentStatus.ASSIGNED)
                .active(true)
                .build());
        assignment.setReplacedByAssignment(successor);
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
                && specification.getVersion() == assignment.getExamVersionSnapshot()
                && specification.getExam().getId().equals(exam.getId());
        int maxGeneration = assignment.getAssignmentCycle() == null
                ? assignments.findMaxResetGeneration(examId, userId, assignment.getExamVersionSnapshot())
                : assignments.findMaxResetGenerationInCycle(assignment.getAssignmentCycle().getId(), userId);
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
        var specificationLimit = assignment.getAssessmentSpecification().getAttemptLimit();
        if (!java.util.Objects.equals(assignment.getAttemptsLimitSnapshot(), specificationLimit)) {
            log.warn("Legacy Certification attempt-limit mismatch for assignmentId={}: snapshot={}, specification={}; preserving snapshot",
                    assignment.getId(), assignment.getAttemptsLimitSnapshot(), specificationLimit);
        }
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

    private TrainingExamAssignment createAssignment(TrainingExam exam, RestaurantMember member,
                                                     CertificationAssessmentSpecification specification,
                                                     CertificationAssignmentCycle cycle) {
        return TrainingExamAssignment.builder()
                .exam(exam)
                .restaurant(exam.getRestaurant())
                .user(member.getUser())
                .assignedPosition(member.getPosition())
                .assessmentSpecification(specification)
                .assignmentCycle(cycle)
                .attemptsLimitSnapshot(specification.getAttemptLimit())
                .examVersionSnapshot(specification.getVersion())
                .status(TrainingExamAssignmentStatus.ASSIGNED)
                .active(true)
                .build();
    }

    private CertificationAssignmentCycle requireCurrentAssignmentCycle(
            TrainingExam exam, CertificationAssessmentSpecification specification) {
        return cycles.findTopByExamIdAndAssessmentSpecificationIdOrderByCycleSequenceDesc(
                        exam.getId(), specification.getId())
                .orElseThrow(() -> new ConflictException("Для текущей версии аттестации отсутствует цикл назначения."));
    }

    private RecertificationPredecessorShape classifyRecertificationPredecessor(
            TrainingExamAssignment assignment, TrainingExam exam,
            CertificationAssessmentSpecification currentSpecification,
            CertificationAssignmentCycle expectedCurrentCycle,
            CertificationAssignmentCycle newCycle,
            java.util.Set<Long> unfinishedAssignmentIds) {
        var assignmentSpecification = assignment.getAssessmentSpecification();
        var assignmentCycle = assignment.getAssignmentCycle();
        boolean internallyConsistent = assignment.getExam() != null
                && assignment.getExam().getId().equals(exam.getId())
                && assignmentSpecification != null
                && assignmentSpecification.getExam() != null
                && assignmentSpecification.getExam().getId().equals(exam.getId())
                && assignmentSpecification.getVersion() == assignment.getExamVersionSnapshot()
                && assignmentCycle != null
                && assignmentCycle.getExam() != null
                && assignmentCycle.getAssessmentSpecification() != null
                && assignmentCycle.getExam().getId().equals(exam.getId())
                && assignmentCycle.getAssessmentSpecification().getId().equals(assignmentSpecification.getId())
                && assignmentCycle.getCycleSequence() < newCycle.getCycleSequence();
        if (!internallyConsistent) {
            return RecertificationPredecessorShape.INVALID;
        }
        if (assignmentSpecification.getId().equals(currentSpecification.getId())) {
            return assignmentCycle.getId().equals(expectedCurrentCycle.getId())
                    ? RecertificationPredecessorShape.CURRENT
                    : RecertificationPredecessorShape.INVALID;
        }
        boolean olderHistorical = assignmentSpecification.getVersion() < currentSpecification.getVersion()
                && assignmentCycle.getCycleSequence() <= expectedCurrentCycle.getCycleSequence();
        if (!olderHistorical) {
            return RecertificationPredecessorShape.INVALID;
        }
        return unfinishedAssignmentIds.contains(assignment.getId())
                ? RecertificationPredecessorShape.GRACEFUL_HISTORICAL
                : RecertificationPredecessorShape.PROVABLY_STALE_HISTORICAL;
    }

    private enum RecertificationPredecessorShape {
        CURRENT,
        GRACEFUL_HISTORICAL,
        PROVABLY_STALE_HISTORICAL,
        INVALID
    }

    private void reactivateCurrentAudienceAssignment(TrainingExamAssignment assignment, RestaurantMember member) {
        assignment.setAssignedPosition(member.getPosition());
        assignment.setActive(true);
        assignment.setDeactivationReason(null);
        assignment.setStatus(TrainingExamAssignmentStatus.ASSIGNED);
        reconcileDerivedStateFromFinishedAttempts(assignment);
        refreshStatus(assignment, attempts.existsByAssignmentIdAndFinishedAtIsNull(assignment.getId()));
    }

    private void validateAssignmentIdentity(TrainingExamAssignment assignment) {
        var specification = assignment.getAssessmentSpecification();
        if (!specification.getExam().getId().equals(assignment.getExam().getId())
                || specification.getVersion() != assignment.getExamVersionSnapshot()
                || (assignment.getAssignmentCycle() != null
                    && (!assignment.getAssignmentCycle().getExam().getId().equals(assignment.getExam().getId())
                        || !assignment.getAssignmentCycle().getAssessmentSpecification().getId().equals(specification.getId())))) {
            throw new ConflictException("Назначение аттестации имеет несогласованную идентичность версии.");
        }
    }

    private TrainingExamAssignment preferCurrentGeneration(TrainingExamAssignment first,
                                                            TrainingExamAssignment second) {
        // Reactivation always targets max generation, never an older active/history row.
        return first.getResetGeneration() >= second.getResetGeneration() ? first : second;
    }
}
