package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.model.*;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
class CertificationAssignmentSyncService {
    private final RestaurantMemberRepository members;
    private final TrainingExamAssignmentRepository assignments;

    @Transactional
    public void syncForExam(TrainingExam exam) {
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            return;
        }

        var audience = resolveAudienceMembers(exam);
        var audienceUserIds = audience.stream().map(member -> member.getUser().getId()).collect(Collectors.toSet());

        var activeAssignments = assignments.findByExamIdAndRestaurantIdAndActiveTrue(exam.getId(), exam.getRestaurant().getId());
        var activeByUserId = activeAssignments.stream()
                .collect(Collectors.toMap(a -> a.getUser().getId(), Function.identity(), (first, second) -> first));

        for (RestaurantMember member : audience) {
            var existing = activeByUserId.get(member.getUser().getId());
            if (existing == null) {
                assignments.save(createAssignment(exam, member));
                continue;
            }
            existing.setAssignedPosition(member.getPosition());
        }

        for (TrainingExamAssignment assignment : activeAssignments) {
            if (!audienceUserIds.contains(assignment.getUser().getId())) {
                assignment.setActive(false);
                assignment.setStatus(TrainingExamAssignmentStatus.ARCHIVED);
            }
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

    private List<RestaurantMember> resolveAudienceMembers(TrainingExam exam) {
        var allMembers = members.findWithUserAndPositionByRestaurantId(exam.getRestaurant().getId());
        var visibilityPositionIds = exam.getVisibilityPositions().stream().map(position -> position.getId()).collect(Collectors.toSet());
        if (visibilityPositionIds.isEmpty()) {
            // Для аттестаций пустая visibility не должна приводить к неявному расширению аудитории.
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