package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.dto.CertificationAnalyticsStatus;
import ru.staffly.training.dto.CertificationEmployeeExamDto;
import ru.staffly.training.dto.CertificationEmployeeSummaryDto;
import ru.staffly.training.model.TrainingExamAssignment;
import ru.staffly.training.repository.TrainingExamAssignmentRepository;

import java.util.ArrayList;
import java.util.Comparator;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.function.Function;
import java.util.stream.Collectors;
import java.util.stream.Stream;

@Service
@RequiredArgsConstructor
public class CertificationEmployeeAnalyticsService {
    private final RestaurantMemberRepository members;
    private final TrainingExamAssignmentRepository assignments;
    private final TrainingPolicyService trainingPolicyService;
    private final CertificationAssignmentService certificationAssignmentService;

    @Transactional(readOnly = true)
    public List<CertificationEmployeeSummaryDto> findCertificationEmployees(Long restaurantId,
                                                                            Long actorUserId,
                                                                            Long positionId,
                                                                            String query) {
        String normalizedQuery = normalizeQuery(query);
        if (positionId == null && normalizedQuery == null) {
            return List.of();
        }

        List<RestaurantMember> filteredMembers;
        if (positionId != null && normalizedQuery != null) {
            filteredMembers = members.findAnalyticsEmployeesByRestaurantIdAndPositionIdAndQuery(
                    restaurantId,
                    positionId,
                    normalizedQuery
            );
        } else if (positionId != null) {
            filteredMembers = members.findAnalyticsEmployeesByRestaurantIdAndPositionId(
                    restaurantId,
                    positionId
            );
        } else {
            filteredMembers = members.findAnalyticsEmployeesByRestaurantIdAndQuery(
                    restaurantId,
                    normalizedQuery
            );
        }

        List<RestaurantMember> visibleMembers = filteredMembers.stream()
                .filter(member -> trainingPolicyService.canAccessCertificationEmployeeAnalyticsTargetRole(
                        actorUserId,
                        restaurantId,
                        member.getRole()))
                .toList();

        if (visibleMembers.isEmpty()) {
            return List.of();
        }

        var memberByUserId = visibleMembers.stream()
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity(), (a, b) -> a));

        List<Long> userIds = new ArrayList<>(memberByUserId.keySet());

        var assignmentsByUserId = assignments.findActiveByRestaurantIdAndUserIds(restaurantId, userIds)
                .stream()
                .filter(assignment -> isCurrentPositionAssignment(
                        assignment,
                        memberByUserId.get(assignment.getUser().getId())
                ))
                .collect(Collectors.groupingBy(assignment -> assignment.getUser().getId()));

        return visibleMembers.stream()
                .map(member -> toSummaryDto(
                        member,
                        assignmentsByUserId.getOrDefault(member.getUser().getId(), List.of())
                ))
                .sorted(Comparator.comparing(
                        CertificationEmployeeSummaryDto::fullName,
                        Comparator.nullsLast(String::compareToIgnoreCase)
                ))
                .toList();
    }

    @Transactional(readOnly = true)
    public List<CertificationEmployeeExamDto> getCertificationEmployeeExams(Long restaurantId,
                                                                            Long actorUserId,
                                                                            Long userId) {
        var member = requireAccessibleMember(restaurantId, actorUserId, userId);

        return loadActiveCurrentPositionAssignments(restaurantId, userId, member)
                .map(assignment -> new CertificationEmployeeExamDto(
                        assignment.getExam().getId(),
                        assignment.getExam().getTitle(),
                        CertificationAnalyticsStatusMapper.fromLifecycle(assignment.getStatus()),
                        assignment.getBestScore(),
                        assignment.getLastAttemptAt(),
                        assignment.getAttemptsUsed(),
                        certificationAssignmentService.calculateAttemptsAllowed(assignment)
                ))
                .sorted(Comparator
                        .comparing(CertificationEmployeeExamDto::lastAttemptAt,
                                Comparator.nullsLast(Comparator.reverseOrder()))
                        .thenComparing(CertificationEmployeeExamDto::examTitle,
                                Comparator.nullsLast(String::compareToIgnoreCase)))
                .toList();
    }

    @Transactional(readOnly = true)
    public CertificationEmployeeSummaryDto getCertificationEmployeeSummary(Long restaurantId,
                                                                           Long actorUserId,
                                                                           Long userId) {
        var member = requireAccessibleMember(restaurantId, actorUserId, userId);
        var userAssignments = loadActiveCurrentPositionAssignments(restaurantId, userId, member).toList();
        return toSummaryDto(member, userAssignments);
    }

    private RestaurantMember requireAccessibleMember(Long restaurantId, Long actorUserId, Long userId) {
        var member = members.findByUserIdAndRestaurantIdWithPosition(userId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Employee not found"));

        if (!trainingPolicyService.canAccessCertificationEmployeeAnalyticsTargetRole(
                actorUserId,
                restaurantId,
                member.getRole()
        )) {
            throw new ForbiddenException("Not enough rights to access employee analytics");
        }

        return member;
    }

    private CertificationEmployeeSummaryDto toSummaryDto(RestaurantMember member,
                                                         List<TrainingExamAssignment> userAssignments) {
        int assignedCount = userAssignments.size();
        int passedCount = countWithStatus(userAssignments, CertificationAnalyticsStatus.PASSED);
        int failedCount = countWithStatus(userAssignments, CertificationAnalyticsStatus.FAILED);
        int completedCount = passedCount + failedCount;

        return new CertificationEmployeeSummaryDto(
                member.getUser().getId(),
                member.getUser().getFullName(),
                member.getPosition() == null ? null : member.getPosition().getId(),
                member.getPosition() == null ? null : member.getPosition().getName(),
                assignedCount,
                completedCount,
                passedCount,
                failedCount
        );
    }

    private int countWithStatus(List<TrainingExamAssignment> rows, CertificationAnalyticsStatus status) {
        return (int) rows.stream()
                .map(TrainingExamAssignment::getStatus)
                .map(CertificationAnalyticsStatusMapper::fromLifecycle)
                .filter(item -> item == status)
                .count();
    }

    private boolean isCurrentPositionAssignment(TrainingExamAssignment assignment, RestaurantMember member) {
        if (member == null) {
            return false;
        }
        Long memberPositionId = member.getPosition() == null ? null : member.getPosition().getId();
        Long assignedPositionId = assignment.getAssignedPosition() == null ? null : assignment.getAssignedPosition().getId();
        return Objects.equals(memberPositionId, assignedPositionId);
    }

    private String normalizeQuery(String query) {
        if (query == null) {
            return null;
        }
        String normalized = query.trim();
        return normalized.isBlank() ? null : normalized.toLowerCase(Locale.ROOT);
    }

    private Stream<TrainingExamAssignment> loadActiveCurrentPositionAssignments(Long restaurantId,
                                                                                Long userId,
                                                                                RestaurantMember member) {
        return assignments.findActiveCertificationAssignmentsForUser(restaurantId, userId)
                .stream()
                .filter(assignment -> isCurrentPositionAssignment(assignment, member));
    }
}