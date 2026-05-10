package ru.staffly.member.responsibility;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.schedule.dto.ScheduleOwnerDto;
import ru.staffly.schedule.service.ScheduleOwnershipService;
import ru.staffly.training.dto.CertificationOwnerCandidateDto;
import ru.staffly.training.dto.OwnedCertificationExamDto;
import ru.staffly.training.service.TrainingExamOwnershipService;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class MemberResponsibilityHandoffService {

    private static final String BLOCKING_RESPONSIBILITIES_MESSAGE =
            "Сотрудник является ответственным за активные объекты. Перед удалением переназначьте ответственных.";

    private final RestaurantMemberRepository members;
    private final MemberRemovalPolicyService memberRemovalPolicyService;
    private final TrainingExamOwnershipService trainingExamOwnershipService;
    private final ScheduleOwnershipService scheduleOwnershipService;

    @Transactional(readOnly = true)
    public MemberResponsibilityHandoffOptionsDto getHandoffOptions(Long restaurantId, Long memberId, Long actorUserId) {
        RestaurantMember targetMember = requireTargetMember(restaurantId, memberId);
        memberRemovalPolicyService.assertCanStartRemoval(restaurantId, actorUserId, targetMember);

        Long targetUserId = targetMember.getUser().getId();
        List<MemberResponsibilityGroupDto> groups = new ArrayList<>();

        Map<Long, RestaurantMember> membersByUserId = members.findWithUserAndPositionByRestaurantId(restaurantId).stream()
                .filter(member -> member.getUser() != null)
                .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity(), (left, right) -> left));

        var ownedCertificationExams = trainingExamOwnershipService.findActiveOwnedCertificationExams(restaurantId, targetUserId);
        if (!ownedCertificationExams.isEmpty()) {
            var certificationOptions = trainingExamOwnershipService.buildReassignmentOptions(restaurantId, actorUserId, targetUserId);
            groups.add(new MemberResponsibilityGroupDto(
                    MemberResponsibilityType.CERTIFICATION,
                    "Аттестации",
                    certificationOptions.ownedExams().stream()
                            .map(exam -> toCertificationItem(exam, membersByUserId))
                            .toList()
            ));
        }

        var ownedSchedules = scheduleOwnershipService.findActiveOrFutureOwnedSchedules(restaurantId, targetUserId);
        if (!ownedSchedules.isEmpty()) {
            var scheduleOptions = scheduleOwnershipService.getReassignmentOptions(restaurantId, actorUserId, targetUserId);
            groups.add(new MemberResponsibilityGroupDto(
                    MemberResponsibilityType.SCHEDULE,
                    "Графики",
                    scheduleOptions.stream()
                            .map(option -> new MemberResponsibilityItemDto(
                                    option.scheduleId(),
                                    option.scheduleTitle(),
                                    null,
                                    new MemberResponsibilityPeriodDto(
                                            java.time.LocalDate.parse(option.startDate()),
                                            java.time.LocalDate.parse(option.endDate())
                                    ),
                                    option.candidates().stream()
                                            .map(candidate -> toScheduleCandidate(candidate, membersByUserId.get(candidate.userId())))
                                            .toList()
                            ))
                            .toList()
            ));
        }

        return new MemberResponsibilityHandoffOptionsDto(
                targetUserId,
                targetMember.getUser().getFullName(),
                groups
        );
    }

    public void handoff(Long restaurantId,
                        Long memberId,
                        Long actorUserId,
                        MemberResponsibilityHandoffRequest request) {
        RestaurantMember targetMember = requireTargetMember(restaurantId, memberId);
        memberRemovalPolicyService.assertCanStartRemoval(restaurantId, actorUserId, targetMember);

        Long targetUserId = targetMember.getUser().getId();
        List<MemberResponsibilityHandoffRequest.Item> requestedItems = request == null || request.items() == null
                ? List.of()
                : request.items();
        validateNoDuplicateItems(requestedItems);

        Set<Long> expectedCertificationIds = trainingExamOwnershipService
                .findActiveOwnedCertificationExams(restaurantId, targetUserId)
                .stream()
                .map(exam -> exam.getId())
                .collect(Collectors.toSet());
        Set<Long> expectedScheduleIds = scheduleOwnershipService
                .findActiveOrFutureOwnedSchedules(restaurantId, targetUserId)
                .stream()
                .map(schedule -> schedule.getId())
                .collect(Collectors.toSet());

        Map<Long, Long> certificationAssignments = assignmentsForType(requestedItems, MemberResponsibilityType.CERTIFICATION);
        Map<Long, Long> scheduleAssignments = assignmentsForType(requestedItems, MemberResponsibilityType.SCHEDULE);

        assertExactCoverage(MemberResponsibilityType.CERTIFICATION, expectedCertificationIds, certificationAssignments.keySet());
        assertExactCoverage(MemberResponsibilityType.SCHEDULE, expectedScheduleIds, scheduleAssignments.keySet());

        if (!certificationAssignments.isEmpty()) {
            trainingExamOwnershipService.batchReassign(
                    restaurantId,
                    actorUserId,
                    targetUserId,
                    certificationAssignments.entrySet().stream().toList()
            );
        }
        if (!scheduleAssignments.isEmpty()) {
            scheduleOwnershipService.reassignOwnedSchedules(restaurantId, actorUserId, targetUserId, scheduleAssignments);
        }
    }

    @Transactional(readOnly = true)
    public void assertNoBlockingResponsibilities(Long restaurantId, Long ownerUserId) {
        boolean hasCertification = !trainingExamOwnershipService.findActiveOwnedCertificationExams(restaurantId, ownerUserId).isEmpty();
        boolean hasSchedules = !scheduleOwnershipService.findActiveOrFutureOwnedSchedules(restaurantId, ownerUserId).isEmpty();
        if (hasCertification || hasSchedules) {
            throw new ConflictException(BLOCKING_RESPONSIBILITIES_MESSAGE);
        }
    }

    private RestaurantMember requireTargetMember(Long restaurantId, Long memberId) {
        RestaurantMember targetMember = members.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (!targetMember.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Member belongs to another restaurant");
        }
        if (targetMember.getUser() == null) {
            throw new BadRequestException("Member has no linked user");
        }
        return targetMember;
    }

    private MemberResponsibilityItemDto toCertificationItem(OwnedCertificationExamDto exam,
                                                             Map<Long, RestaurantMember> membersByUserId) {
        String subtitle = exam.visibilityPositionNames() == null || exam.visibilityPositionNames().isEmpty()
                ? "Позиции: все"
                : "Позиции: " + String.join(", ", exam.visibilityPositionNames());
        return new MemberResponsibilityItemDto(
                exam.examId(),
                exam.title(),
                subtitle,
                null,
                exam.candidates().stream()
                        .map(candidate -> toCertificationCandidate(candidate, membersByUserId.get(candidate.userId())))
                        .toList()
        );
    }

    private MemberResponsibilityCandidateDto toCertificationCandidate(CertificationOwnerCandidateDto candidate,
                                                                       RestaurantMember member) {
        return new MemberResponsibilityCandidateDto(
                candidate.userId(),
                member == null ? null : member.getId(),
                candidate.fullName(),
                candidate.role(),
                candidate.positionId(),
                candidate.positionName()
        );
    }

    private MemberResponsibilityCandidateDto toScheduleCandidate(ScheduleOwnerDto candidate, RestaurantMember member) {
        return new MemberResponsibilityCandidateDto(
                candidate.userId(),
                candidate.memberId(),
                candidate.displayName(),
                candidate.role(),
                member == null || member.getPosition() == null ? null : member.getPosition().getId(),
                candidate.positionName()
        );
    }

    private void validateNoDuplicateItems(List<MemberResponsibilityHandoffRequest.Item> items) {
        Set<String> seen = new HashSet<>();
        for (var item : items) {
            if (item.type() == null || item.resourceId() == null || item.newOwnerUserId() == null) {
                throw new BadRequestException("type, resourceId and newOwnerUserId are required for every handoff item");
            }
            String key = item.type() + ":" + item.resourceId();
            if (!seen.add(key)) {
                throw new BadRequestException("Duplicate responsibility handoff item: " + key);
            }
        }
    }

    private Map<Long, Long> assignmentsForType(List<MemberResponsibilityHandoffRequest.Item> items,
                                               MemberResponsibilityType type) {
        Map<Long, Long> assignments = new HashMap<>();
        items.stream()
                .filter(item -> item.type() == type)
                .forEach(item -> assignments.put(item.resourceId(), item.newOwnerUserId()));
        return assignments;
    }

    private void assertExactCoverage(MemberResponsibilityType type, Set<Long> expectedIds, Set<Long> requestedIds) {
        if (Objects.equals(expectedIds, requestedIds)) {
            return;
        }
        if (!requestedIds.containsAll(expectedIds)) {
            throw new BadRequestException("Нужно передать нового ответственного для всех активных объектов типа " + type);
        }
        throw new BadRequestException("Передан resourceId типа " + type + ", который не требует переназначения для указанного сотрудника");
    }
}
