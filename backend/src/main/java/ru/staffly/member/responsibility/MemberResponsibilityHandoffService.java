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
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.inbox.service.BusinessNotificationOperationId;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.schedule.dto.AppliedScheduleOwnershipTransfer;
import ru.staffly.schedule.dto.ScheduleOwnerDto;
import ru.staffly.schedule.service.ScheduleOwnershipService;
import ru.staffly.training.dto.AppliedCertificationOwnershipTransfer;
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
import java.util.UUID;
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
    private final InboxMessageService inboxMessages;

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
            var scheduleCandidates = scheduleOwnershipService.getHandoffOwnerCandidates(restaurantId, actorUserId, targetUserId);
            groups.add(new MemberResponsibilityGroupDto(
                    MemberResponsibilityType.SCHEDULE,
                    "Графики",
                    ownedSchedules.stream()
                            .map(schedule -> new MemberResponsibilityItemDto(
                                    schedule.getId(),
                                    schedule.getVersion(),
                                    schedule.getTitle(),
                                    null,
                                    new MemberResponsibilityPeriodDto(
                                            schedule.getStartDate(),
                                            schedule.getEndDate()
                                    ),
                                    scheduleCandidates.stream()
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
        Map<Long, Long> scheduleVersions = new HashMap<>();
        requestedItems.stream()
                .filter(item -> item.type() == MemberResponsibilityType.SCHEDULE)
                .forEach(item -> {
                    if (item.resourceVersion() == null) {
                        throw new BadRequestException("resourceVersion is required for schedules");
                    }
                    scheduleVersions.put(item.resourceId(), item.resourceVersion());
                });

        assertExactCoverage(MemberResponsibilityType.CERTIFICATION, expectedCertificationIds, certificationAssignments.keySet());
        assertExactCoverage(MemberResponsibilityType.SCHEDULE, expectedScheduleIds, scheduleAssignments.keySet());

        List<AppliedCertificationOwnershipTransfer> appliedCertifications = List.of();
        if (!certificationAssignments.isEmpty()) {
            appliedCertifications = trainingExamOwnershipService.batchReassign(
                    restaurantId,
                    actorUserId,
                    targetUserId,
                    certificationAssignments.entrySet().stream().toList()
            );
        }
        List<AppliedScheduleOwnershipTransfer> appliedSchedules = List.of();
        if (!scheduleAssignments.isEmpty()) {
            appliedSchedules = scheduleOwnershipService.reassignOwnedSchedules(
                    restaurantId, actorUserId, targetUserId, scheduleAssignments, scheduleVersions
            );
        }

        UUID operationId = BusinessNotificationOperationId.generate();
        createResponsibilityNotifications(
                targetMember, actorUserId, operationId, appliedSchedules, appliedCertifications);
    }

    private void createResponsibilityNotifications(
            RestaurantMember targetMember,
            Long actorUserId,
            UUID operationId,
            List<AppliedScheduleOwnershipTransfer> schedules,
            List<AppliedCertificationOwnershipTransfer> certifications) {
        Set<Long> newOwnerUserIds = new HashSet<>();
        schedules.forEach(transfer -> newOwnerUserIds.add(transfer.newOwnerUserId()));
        certifications.forEach(transfer -> newOwnerUserIds.add(transfer.newOwnerUserId()));
        Map<Long, RestaurantMember> recipientsByUserId = newOwnerUserIds.isEmpty()
                ? Map.of()
                : members.findByRestaurantIdAndUserIdIn(targetMember.getRestaurant().getId(), newOwnerUserIds).stream()
                        .collect(Collectors.toMap(member -> member.getUser().getId(), Function.identity()));

        var actor = ru.staffly.user.model.User.builder().id(actorUserId).build();
        schedules.stream()
                .collect(Collectors.groupingBy(
                        AppliedScheduleOwnershipTransfer::newOwnerUserId,
                        java.util.LinkedHashMap::new,
                        Collectors.toList()))
                .forEach((ownerUserId, transfers) -> inboxMessages.createBusinessNotification(
                        new BusinessNotificationCommand(
                                targetMember.getRestaurant(), operationId, recipientsByUserId.get(ownerUserId), actor,
                                BusinessNotificationKind.SCHEDULE, scheduleInboxText(transfers),
                                schedulePushText(transfers), resourceMetadata(transfers.stream()
                                        .map(AppliedScheduleOwnershipTransfer::scheduleId).toList()), null)));

        certifications.stream()
                .collect(Collectors.groupingBy(
                        AppliedCertificationOwnershipTransfer::newOwnerUserId,
                        java.util.LinkedHashMap::new,
                        Collectors.toList()))
                .forEach((ownerUserId, transfers) -> inboxMessages.createBusinessNotification(
                        new BusinessNotificationCommand(
                                targetMember.getRestaurant(), operationId, recipientsByUserId.get(ownerUserId), actor,
                                BusinessNotificationKind.CERTIFICATION, certificationInboxText(transfers),
                                certificationPushText(transfers), resourceMetadata(transfers.stream()
                                        .map(AppliedCertificationOwnershipTransfer::certificationId).toList()), null)));
    }

    private String scheduleInboxText(List<AppliedScheduleOwnershipTransfer> transfers) {
        if (transfers.size() == 1) {
            return "Вам передали ответственность за график «" + transfers.get(0).title() + "».";
        }
        return "Вам передали ответственность за графики:\n\n" + bulletList(
                transfers.stream().map(AppliedScheduleOwnershipTransfer::title).toList());
    }

    private String schedulePushText(List<AppliedScheduleOwnershipTransfer> transfers) {
        if (transfers.size() == 1) {
            return "Вам передали ответственность за график «" + transfers.get(0).title() + "».";
        }
        return "Вам передали ответственность за " + transfers.size() + " "
                + russianCountForm(transfers.size(), "график", "графика", "графиков") + ".";
    }

    private String certificationInboxText(List<AppliedCertificationOwnershipTransfer> transfers) {
        if (transfers.size() == 1) {
            return "Вам передали ответственность за аттестацию «" + transfers.get(0).title() + "».";
        }
        return "Вам передали ответственность за аттестации:\n\n" + bulletList(
                transfers.stream().map(AppliedCertificationOwnershipTransfer::title).toList());
    }

    private String certificationPushText(List<AppliedCertificationOwnershipTransfer> transfers) {
        if (transfers.size() == 1) {
            return "Вам передали ответственность за аттестацию «" + transfers.get(0).title() + "».";
        }
        return "Вам передали ответственность за " + transfers.size() + " "
                + russianCountForm(transfers.size(), "аттестацию", "аттестации", "аттестаций") + ".";
    }

    private String bulletList(List<String> titles) {
        return titles.stream().map(title -> "• " + title).collect(Collectors.joining("\n"));
    }

    private Map<String, Object> resourceMetadata(List<Long> resourceIds) {
        return Map.of("resourceIds", resourceIds.stream().sorted().toList());
    }

    private String russianCountForm(int count, String singular, String few, String many) {
        int lastTwo = count % 100;
        if (lastTwo >= 11 && lastTwo <= 14) {
            return many;
        }
        return switch (count % 10) {
            case 1 -> singular;
            case 2, 3, 4 -> few;
            default -> many;
        };
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
                null,
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
