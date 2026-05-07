package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.schedule.dto.ScheduleOwnerDto;
import ru.staffly.schedule.dto.ScheduleOwnerReassignmentOptionDto;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleAuditAction;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.util.Comparator;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.function.Function;
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

    public Schedule changeOwner(Long restaurantId, Long actorUserId, Long scheduleId, Long newOwnerUserId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        Schedule schedule = requireManageableSchedule(restaurantId, actorUserId, scheduleId);
        RestaurantMember newOwner = requireOwnerCandidate(restaurantId, newOwnerUserId);

        Long currentOwnerUserId = schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId();
        if (Objects.equals(currentOwnerUserId, newOwnerUserId)) {
            return schedule;
        }

        String details = buildOwnerChangedDetails(schedule.getOwnerMember(), newOwner);
        schedule.setOwnerUser(newOwner.getUser());
        schedule.setOwnerMember(newOwner);
        Schedule saved = schedules.save(schedule);
        scheduleAuditService.record(saved, actorUserId, ScheduleAuditAction.OWNER_CHANGED, details);
        return saved;
    }

    @Transactional(readOnly = true)
    public List<ScheduleOwnerDto> getOwnerCandidates(Long restaurantId, Long actorUserId, Long scheduleId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        requireManageableSchedule(restaurantId, actorUserId, scheduleId);
        return findOwnerCandidateMembers(restaurantId, null, null).stream()
                .map(this::toOwnerDto)
                .toList();
    }

    @Transactional(readOnly = true)
    public List<Schedule> findActiveOrFutureOwnedSchedules(Long restaurantId, Long ownerUserId) {
        LocalDate today = TimeProvider.todayUtc();
        return schedules.findByRestaurantIdAndOwnerUserIdAndEndDateGreaterThanEqualOrderByStartDateAsc(
                restaurantId,
                ownerUserId,
                today
        );
    }

    @Transactional(readOnly = true)
    public void assertNoActiveOwnedSchedules(Long restaurantId, Long ownerUserId) {
        if (!findActiveOrFutureOwnedSchedules(restaurantId, ownerUserId).isEmpty()) {
            throw new ConflictException("Сотрудник является ответственным за активные или будущие графики");
        }
    }

    @Transactional(readOnly = true)
    public List<ScheduleOwnerReassignmentOptionDto> getReassignmentOptions(Long restaurantId,
                                                                           Long actorUserId,
                                                                           Long ownerUserId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        RestaurantRole oldOwnerRole = resolveOwnerRole(restaurantId, ownerUserId);
        List<RestaurantMember> candidates = findOwnerCandidateMembers(restaurantId, ownerUserId, oldOwnerRole);
        return findActiveOrFutureOwnedSchedules(restaurantId, ownerUserId).stream()
                .map(schedule -> new ScheduleOwnerReassignmentOptionDto(
                        schedule.getId(),
                        schedule.getTitle(),
                        schedule.getStartDate().toString(),
                        schedule.getEndDate().toString(),
                        buildOwnerDto(schedule),
                        candidates.stream().map(this::toOwnerDto).toList()
                ))
                .toList();
    }

    public void reassignOwnedSchedules(Long restaurantId,
                                       Long actorUserId,
                                       Long oldOwnerUserId,
                                       Map<Long, Long> ownerUserIdsByScheduleId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
        if (ownerUserIdsByScheduleId == null || ownerUserIdsByScheduleId.isEmpty()) {
            throw new BadRequestException("ownerUserIdsByScheduleId is required");
        }

        List<Schedule> ownedSchedules = findActiveOrFutureOwnedSchedules(restaurantId, oldOwnerUserId);
        Set<Long> ownedScheduleIds = ownedSchedules.stream().map(Schedule::getId).collect(Collectors.toSet());
        Set<Long> requestedScheduleIds = ownerUserIdsByScheduleId.keySet();

        if (!requestedScheduleIds.equals(ownedScheduleIds)) {
            if (!requestedScheduleIds.containsAll(ownedScheduleIds)) {
                throw new BadRequestException("Нужно передать нового ответственного для каждого активного или будущего графика");
            }
            throw new BadRequestException("Передан scheduleId, который не принадлежит указанному ответственному или ресторану");
        }

        RestaurantRole oldOwnerRole = resolveOwnerRole(restaurantId, oldOwnerUserId);
        Map<Long, Schedule> schedulesById = ownedSchedules.stream()
                .collect(Collectors.toMap(Schedule::getId, Function.identity()));

        for (Map.Entry<Long, Long> entry : ownerUserIdsByScheduleId.entrySet()) {
            RestaurantMember newOwner = requireOwnerCandidate(restaurantId, entry.getValue());
            if (Objects.equals(newOwner.getUser().getId(), oldOwnerUserId)) {
                throw new BadRequestException("Новый ответственный должен отличаться от увольняемого сотрудника");
            }
            if (!canReplaceOwner(oldOwnerRole, newOwner.getRole())) {
                throw new BadRequestException("Новый ответственный должен иметь роль не ниже роли текущего ответственного");
            }
        }

        for (Map.Entry<Long, Long> entry : ownerUserIdsByScheduleId.entrySet()) {
            Schedule schedule = schedulesById.get(entry.getKey());
            RestaurantMember newOwner = requireOwnerCandidate(restaurantId, entry.getValue());
            String details = buildOwnerChangedDetails(schedule.getOwnerMember(), newOwner);
            schedule.setOwnerUser(newOwner.getUser());
            schedule.setOwnerMember(newOwner);
            Schedule saved = schedules.save(schedule);
            scheduleAuditService.record(saved, actorUserId, ScheduleAuditAction.OWNER_CHANGED, details);
        }
        schedules.flush();
    }

    private Schedule requireManageableSchedule(Long restaurantId, Long actorUserId, Long scheduleId) {
        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        scheduleAccessService.assertCanManageSchedule(actorUserId, schedule);
        return schedule;
    }

    private RestaurantMember requireOwnerCandidate(Long restaurantId, Long ownerUserId) {
        if (ownerUserId == null) {
            throw new BadRequestException("ownerUserId is required");
        }
        RestaurantMember owner = members.findByUserIdAndRestaurantIdWithPosition(ownerUserId, restaurantId)
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
        return members.findByUserIdAndRestaurantId(ownerUserId, restaurantId)
                .map(RestaurantMember::getRole)
                .orElse(RestaurantRole.STAFF);
    }

    private List<RestaurantMember> findOwnerCandidateMembers(Long restaurantId,
                                                             Long excludedUserId,
                                                             RestaurantRole oldOwnerRole) {
        return members.findWithUserAndPositionByRestaurantId(restaurantId).stream()
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

    private ScheduleOwnerDto buildOwnerDto(Schedule schedule) {
        RestaurantMember owner = schedule.getOwnerMember();
        return owner == null ? null : toOwnerDto(owner);
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
}