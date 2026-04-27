package ru.staffly.training.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.training.dto.CertificationOwnerCandidateDto;
import ru.staffly.training.dto.CertificationOwnerReassignmentOptionsDto;
import ru.staffly.training.dto.OwnedCertificationExamDto;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.model.TrainingExamMode;
import ru.staffly.training.repository.TrainingExamRepository;
import ru.staffly.user.model.User;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class TrainingExamOwnershipService {
    private final TrainingExamRepository exams;
    private final RestaurantMemberRepository members;
    private final TrainingPolicyService trainingPolicyService;

    public void assignInitialOwner(TrainingExam exam, Long actorUserId) {
        var actorUser = User.builder().id(actorUserId).build();
        exam.setCreatedBy(actorUser);
        exam.setOwner(actorUser);
    }

    public TrainingExam changeOwner(Long restaurantId, Long actorUserId, Long examId, Long newOwnerUserId) {
        var exam = requireManageableCertificationExam(restaurantId, actorUserId, examId);
        validateOwnerCandidate(exam, newOwnerUserId);
        exam.setOwner(User.builder().id(newOwnerUserId).build());
        return exam;
    }

    public List<TrainingExam> findActiveOwnedCertificationExams(Long restaurantId, Long ownerUserId) {
        return exams.findActiveCertificationByRestaurantIdAndOwnerUserIdWithVisibility(restaurantId, ownerUserId);
    }

    public void assertNoActiveOwnedCertificationExams(Long restaurantId, Long ownerUserId) {
        if (!findActiveOwnedCertificationExams(restaurantId, ownerUserId).isEmpty()) {
            throw new ConflictException("Сотрудник является ответственным за активные аттестации. Перед увольнением переназначьте ответственного.");
        }
    }

    public CertificationOwnerReassignmentOptionsDto buildReassignmentOptions(Long restaurantId, Long actorUserId, Long ownerUserId) {
        if (!trainingPolicyService.canManageTraining(actorUserId, restaurantId)) {
            throw new ForbiddenException("Only managers can manage exam ownership");
        }

        RestaurantMember ownerMember = members.findByUserIdAndRestaurantIdWithPosition(ownerUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
        List<TrainingExam> ownedExams = findActiveOwnedCertificationExams(restaurantId, ownerUserId)
                .stream()
                .filter(exam -> canActorManageExam(actorUserId, restaurantId, exam))
                .toList();

        if (ownedExams.isEmpty()) {
            return new CertificationOwnerReassignmentOptionsDto(
                    ownerUserId,
                    ownerMember.getUser() == null ? null : ownerMember.getUser().getFullName(),
                    List.of()
            );
        }

        List<RestaurantMember> candidateMembers = members.findWithUserAndPositionByRestaurantId(restaurantId).stream()
                .filter(member -> member.getUser() != null)
                .filter(member -> !Objects.equals(member.getUser().getId(), ownerUserId))
                .filter(member -> trainingPolicyService.canManageTraining(member.getUser().getId(), restaurantId))
                .toList();

        List<OwnedCertificationExamDto> examDtos = ownedExams.stream()
                .map(exam -> toOwnedExamDto(exam, candidateMembers))
                .toList();

        return new CertificationOwnerReassignmentOptionsDto(
                ownerUserId,
                ownerMember.getUser() == null ? null : ownerMember.getUser().getFullName(),
                examDtos
        );
    }

    public CertificationOwnerReassignmentOptionsDto batchReassign(Long restaurantId,
                                                                  Long actorUserId,
                                                                  Long ownerUserId,
                                                                  List<Map.Entry<Long, Long>> reassignments) {
        if (!trainingPolicyService.canManageTraining(actorUserId, restaurantId)) {
            throw new ForbiddenException("Only managers can manage exam ownership");
        }
        if (reassignments == null || reassignments.isEmpty()) {
            throw new BadRequestException("Reassignment items are required");
        }

        var distinctExamIds = reassignments.stream().map(Map.Entry::getKey).distinct().toList();
        if (distinctExamIds.size() != reassignments.size()) {
            throw new BadRequestException("Duplicate examId in reassignment items");
        }
        var requestedExamIds = distinctExamIds;
        var examsById = exams.findActiveCertificationByRestaurantIdAndIdInWithVisibility(restaurantId, requestedExamIds)
                .stream()
                .collect(Collectors.toMap(TrainingExam::getId, Function.identity()));

        for (var item : reassignments) {
            var exam = examsById.get(item.getKey());
            if (exam == null) {
                throw new NotFoundException("Exam not found");
            }
            if (!Objects.equals(exam.getOwner() == null ? null : exam.getOwner().getId(), ownerUserId)) {
                throw new ConflictException("Exam is not owned by specified user");
            }
            if (!canActorManageExam(actorUserId, restaurantId, exam)) {
                throw new ForbiddenException("Training exam-target policy does not allow access to this visibility scope.");
            }
            validateOwnerCandidate(exam, item.getValue());
        }

        for (var item : reassignments) {
            examsById.get(item.getKey()).setOwner(User.builder().id(item.getValue()).build());
        }

        return buildReassignmentOptions(restaurantId, actorUserId, ownerUserId);
    }

    public void validateOwnerCandidate(TrainingExam exam, Long ownerUserId) {
        if (ownerUserId == null) {
            throw new BadRequestException("ownerUserId is required");
        }
        Long restaurantId = exam.getRestaurant().getId();
        var candidate = members.findByUserIdAndRestaurantIdWithPosition(ownerUserId, restaurantId)
                .orElseThrow(() -> new BadRequestException("Owner must be a restaurant member"));

        if (!trainingPolicyService.canManageTraining(ownerUserId, restaurantId)) {
            throw new ForbiddenException("Selected owner cannot manage training");
        }

        var visibilityPositionIds = exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet());
        trainingPolicyService.assertCanUseExamTargetPositions(ownerUserId, restaurantId, visibilityPositionIds);

        if (candidate.getUser() == null) {
            throw new BadRequestException("Owner member has no linked user");
        }
    }

    private OwnedCertificationExamDto toOwnedExamDto(TrainingExam exam, List<RestaurantMember> candidateMembers) {
        var visibilityPositions = exam.getVisibilityPositions().stream()
                .sorted(Comparator.comparing(Position::getId))
                .toList();
        var visibilityIds = visibilityPositions.stream().map(Position::getId).toList();
        var visibilityNames = visibilityPositions.stream().map(Position::getName).toList();

        var candidates = candidateMembers.stream()
                .filter(member -> canManageExamVisibility(member, exam))
                .map(member -> new CertificationOwnerCandidateDto(
                        member.getUser().getId(),
                        member.getUser().getFullName(),
                        member.getRole(),
                        member.getPosition() == null ? null : member.getPosition().getId(),
                        member.getPosition() == null ? null : member.getPosition().getName()
                ))
                .toList();

        return new OwnedCertificationExamDto(
                exam.getId(),
                exam.getTitle(),
                visibilityIds,
                visibilityNames,
                candidates
        );
    }

    private boolean canManageExamVisibility(RestaurantMember candidateMember, TrainingExam exam) {
        if (candidateMember.getUser() == null) {
            return false;
        }
        try {
            trainingPolicyService.assertCanUseExamTargetPositions(
                    candidateMember.getUser().getId(),
                    exam.getRestaurant().getId(),
                    exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
            );
            return true;
        } catch (ForbiddenException ex) {
            return false;
        }
    }

    private TrainingExam requireManageableCertificationExam(Long restaurantId, Long actorUserId, Long examId) {
        var exam = exams.findByIdAndRestaurantIdWithVisibility(examId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Exam not found"));
        if (exam.getMode() != TrainingExamMode.CERTIFICATION) {
            throw new BadRequestException("Операция доступна только для аттестационного теста.");
        }
        if (!canActorManageExam(actorUserId, restaurantId, exam)) {
            throw new ForbiddenException("Training exam-target policy does not allow access to this visibility scope.");
        }
        return exam;
    }

    private boolean canActorManageExam(Long actorUserId, Long restaurantId, TrainingExam exam) {
        try {
            trainingPolicyService.assertCanAccessExamTargetByVisibility(
                    actorUserId,
                    restaurantId,
                    exam.getVisibilityPositions().stream().map(Position::getId).collect(Collectors.toSet())
            );
            return true;
        } catch (ForbiddenException ex) {
            return false;
        }
    }
}