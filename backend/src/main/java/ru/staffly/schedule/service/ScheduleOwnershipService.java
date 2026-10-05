package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.inbox.model.InboxEventSubtype;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.dto.ScheduleOwnerDto;
import ru.staffly.schedule.dto.AppliedScheduleOwnershipTransfer;
import ru.staffly.schedule.exception.ScheduleVersionConflictException;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleOwnershipService {

    private final ScheduleRepository schedules;
    private final RestaurantMemberRepository members;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleAuditService scheduleAuditService;
    private final SecurityService securityService;
    private final InboxMessageService inboxMessages;
    private final RestaurantTimeService restaurantTime;
    private final RestaurantLifecycleMutex lifecycleMutex;

    public Schedule changeOwner(Long restaurantId, Long actorUserId, Long scheduleId, Long expectedVersion,
                                Long newOwnerUserId) {
        lifecycleMutex.lock(restaurantId);
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        Schedule schedule = requireManageableScheduleForUpdate(restaurantId, actorUserId, scheduleId);
        if (!Objects.equals(schedule.getVersion(), expectedVersion)) {
            throw new ScheduleVersionConflictException(expectedVersion, schedule.getVersion());
        }
        RestaurantMember newOwner = requireOwnerCandidate(restaurantId, newOwnerUserId);

        Long currentOwnerUserId = schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId();
        if (Objects.equals(currentOwnerUserId, newOwnerUserId)) {
            return schedule;
        }

        String details = buildOwnerChangedDetails(schedule.getOwnerMember(), newOwner);
        schedule.setOwnerUser(newOwner.getUser());
        schedule.setOwnerMember(newOwner);
        Schedule saved = schedules.saveAndFlush(schedule);
        scheduleAuditService.record(saved, actorUserId, ScheduleAuditAction.OWNER_CHANGED, details);
        notifyNewOwner(saved, newOwner, actorUserId);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<ScheduleOwnerDto> getOwnerCandidates(Long restaurantId, Long actorUserId, Long scheduleId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        scheduleAccessService.assertCanManageSchedule(actorUserId, schedule);
        return findOwnerCandidateMembers(restaurantId, null, null).stream()
                .map(this::toOwnerDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Schedule> findActiveOrFutureOwnedSchedules(Long restaurantId, Long ownerUserId) {
        LocalDate today = restaurantTime.today(restaurantId);
        return schedules.findByRestaurantIdAndOwnerUserIdAndEndDateGreaterThanEqualOrderByStartDateAsc(
                restaurantId,
                ownerUserId,
                today
        );
    }

    @Transactional(readOnly = true)
    public List<ScheduleOwnerDto> getHandoffOwnerCandidates(Long restaurantId,
                                                            Long actorUserId,
                                                            Long ownerUserId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        RestaurantRole oldOwnerRole = resolveOwnerRole(restaurantId, ownerUserId);
        return findOwnerCandidateMembers(restaurantId, ownerUserId, oldOwnerRole).stream()
                .map(this::toOwnerDto)
                .toList();
    }

    /** Termination primitive. Caller owns restaurant/member and every Schedule lock in ascending ID order. */
    public List<AppliedScheduleOwnershipTransfer> reassignOwnedSchedulesWithLocksHeld(
            Long restaurantId, Long actorUserId, Long oldOwnerUserId, List<Schedule> lockedOwnedSchedules,
            Map<Long, Long> ownerUserIdsByScheduleId, Map<Long, Long> expectedVersionsByScheduleId,
            java.time.Instant operationNow) {
        return reassignOwnedSchedulesWithLocksHeld(restaurantId, actorUserId, oldOwnerUserId, lockedOwnedSchedules,
                ownerUserIdsByScheduleId, expectedVersionsByScheduleId, resolveOwnerRole(restaurantId, oldOwnerUserId), operationNow);
    }

    public List<AppliedScheduleOwnershipTransfer> reassignOwnedSchedulesWithLocksHeld(
            Long restaurantId, Long actorUserId, Long oldOwnerUserId, List<Schedule> lockedOwnedSchedules,
            Map<Long, Long> ownerUserIdsByScheduleId, Map<Long, Long> expectedVersionsByScheduleId,
            RestaurantRole resultingRole, java.time.Instant operationNow) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        Set<Long> expectedIds = lockedOwnedSchedules.stream().map(Schedule::getId).collect(Collectors.toSet());
        if (!expectedIds.equals(ownerUserIdsByScheduleId.keySet())) throw new BadRequestException("Набор графиков изменился");
        RestaurantRole oldOwnerRole = resultingRole;
        List<AppliedScheduleOwnershipTransfer> result = new java.util.ArrayList<>();
        for (Schedule schedule : lockedOwnedSchedules.stream().sorted(Comparator.comparing(Schedule::getId)).toList()) {
            if (schedule.getOwnerUser() == null || !Objects.equals(schedule.getOwnerUser().getId(), oldOwnerUserId)
                    || !Objects.equals(schedule.getVersion(), expectedVersionsByScheduleId.get(schedule.getId()))) {
                throw new ScheduleVersionConflictException(expectedVersionsByScheduleId.get(schedule.getId()), schedule.getVersion());
            }
            RestaurantMember replacement = requireOwnerCandidate(restaurantId, ownerUserIdsByScheduleId.get(schedule.getId()));
            if (Objects.equals(replacement.getUser().getId(), oldOwnerUserId)
                    || !canReplaceOwner(oldOwnerRole, replacement.getRole())) throw new BadRequestException("Некорректный новый ответственный");
            String details = buildOwnerChangedDetails(schedule.getOwnerMember(), replacement);
            schedule.setOwnerUser(replacement.getUser()); schedule.setOwnerMember(replacement);
            scheduleAuditService.record(schedule, actorUserId, ScheduleAuditAction.OWNER_CHANGED,
                    details, operationNow);
            result.add(new AppliedScheduleOwnershipTransfer(schedule.getId(), schedule.getTitle(), replacement.getUser().getId()));
        }
        return List.copyOf(result);
    }

    private Schedule requireManageableScheduleForUpdate(Long restaurantId, Long actorUserId, Long scheduleId) {
        Schedule schedule = schedules.findForUpdateByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        scheduleAccessService.assertCanManageSchedule(actorUserId, schedule);
        return schedule;
    }

    private RestaurantMember requireOwnerCandidate(Long restaurantId, Long ownerUserId) {
        if (ownerUserId == null) {
            throw new BadRequestException("ownerUserId is required");
        }
        RestaurantMember owner = members.findActiveByUserIdAndRestaurantIdWithPosition(ownerUserId, restaurantId)
                .orElseThrow(() -> new BadRequestException("ownerUserId must belong to the restaurant"));
        if (owner.getUser() == null) {
            throw new BadRequestException("Owner member has no linked user");
        }
        if (!isScheduleOwnerRole(owner.getRole())) {
            throw new BadRequestException("owner must be MANAGER or ADMIN");
        }
        return owner;
    }

    private RestaurantRole resolveOwnerRole(Long restaurantId, Long ownerUserId) {
        return members.findActiveByUserIdAndRestaurantId(ownerUserId, restaurantId)
                .map(RestaurantMember::getRole)
                .orElse(RestaurantRole.STAFF);
    }

    private List<RestaurantMember> findOwnerCandidateMembers(Long restaurantId,
                                                             Long excludedUserId,
                                                             RestaurantRole oldOwnerRole) {
        return members.findActiveWithUserAndPositionByRestaurantId(restaurantId).stream()
                .filter(member -> member.getUser() != null)
                .filter(member -> !Objects.equals(member.getUser().getId(), excludedUserId))
                .filter(member -> isScheduleOwnerRole(member.getRole()))
                .filter(member -> oldOwnerRole == null || canReplaceOwner(oldOwnerRole, member.getRole()))
                .sorted(Comparator
                        .comparingInt((RestaurantMember member) -> roleRank(member.getRole())).reversed()
                        .thenComparing(this::displayName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER)))
                .toList();
    }

    private boolean isScheduleOwnerRole(RestaurantRole role) {
        return role == RestaurantRole.ADMIN || role == RestaurantRole.MANAGER;
    }

    private boolean canReplaceOwner(RestaurantRole oldRole, RestaurantRole newRole) {
        if (!isScheduleOwnerRole(newRole)) {
            return false;
        }
        if (oldRole == RestaurantRole.ADMIN) {
            return newRole == RestaurantRole.ADMIN;
        }
        return true;
    }

    private int roleRank(RestaurantRole role) {
        if (role == RestaurantRole.ADMIN) return 2;
        if (role == RestaurantRole.MANAGER) return 1;
        return 0;
    }

    private ScheduleOwnerDto toOwnerDto(RestaurantMember member) {
        return new ScheduleOwnerDto(
                member.getUser() == null ? null : member.getUser().getId(),
                member.getId(),
                displayName(member),
                member.getRole(),
                member.getPosition() == null ? null : member.getPosition().getName()
        );
    }

    private String displayName(RestaurantMember member) {
        return member.getUser() == null ? null : member.getUser().getFullName();
    }

    private String buildOwnerChangedDetails(RestaurantMember oldOwner, RestaurantMember newOwner) {
        String oldName = oldOwner == null ? "—" : Objects.toString(displayName(oldOwner), "—");
        String newName = Objects.toString(displayName(newOwner), "—");
        return "Ответственный изменён: " + oldName + " → " + newName;
    }

    private void notifyNewOwner(Schedule schedule, RestaurantMember newOwner, Long actorUserId) {
        if (newOwner == null || newOwner.getUser() == null
                || Objects.equals(newOwner.getUser().getId(), actorUserId)) {
            return;
        }
        RestaurantMember actor = members.findActiveByUserIdAndRestaurantId(actorUserId, schedule.getRestaurant().getId())
                .orElse(null);
        inboxMessages.createEvent(
                schedule.getRestaurant(),
                actor == null ? null : actor.getUser(),
                "Вы назначены ответственным за график «" + schedule.getTitle() + "».",
                InboxEventSubtype.SCHEDULE_DECISION,
                "schedule:owner-changed:restaurant:" + schedule.getRestaurant().getId()
                        + ":schedule:" + schedule.getId() + ":version:" + schedule.getVersion()
                        + ":owner:" + newOwner.getUser().getId(),
                List.of(newOwner),
                null
        );
    }
}
