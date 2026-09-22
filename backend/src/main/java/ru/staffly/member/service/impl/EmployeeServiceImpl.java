package ru.staffly.member.service.impl;

import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.invite.mapper.InvitationMapper;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.model.InvitationScheduleIntent;
import ru.staffly.invite.model.InvitationScheduleIntentAction;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.invite.repository.InvitationScheduleIntentRepository;
import ru.staffly.invite.exception.InvitationImpactPlanStaleException;
import ru.staffly.invite.exception.InvitationInvalidatedException;
import ru.staffly.invite.exception.InvitationExpiredException;
import ru.staffly.invite.dto.InvitationImpactPlan;
import ru.staffly.invite.service.InvitationImpactService;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.SchedulePositionIds;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import ru.staffly.invite.service.InvitationAcceptanceOwnerNotificationService;
import ru.staffly.invite.service.InvitationSenderNotificationService;
import ru.staffly.inbox.service.BusinessNotificationOperationId;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.TreeMap;
import java.util.Objects;
import java.util.ArrayList;
import java.util.UUID;
import java.util.function.Function;

import static ru.staffly.common.util.InviteUtils.*;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final InvitationRepository invitations;
    private final RestaurantMemberRepository members;
    private final RestaurantRepository restaurants;
    private final UserRepository users;
    private final ScheduleRepository schedules;
    private final InvitationScheduleIntentRepository invitationIntents;
    private final InvitationImpactService invitationImpactService;
    private final SchedulePreferenceLifecycleService preferenceLifecycle;
    private final RestaurantTimeService restaurantTime;

    private final InvitationMapper invitationMapper;
    private final MemberMapper memberMapper;
    private final SecurityService security;
    private final CertificationAudienceSyncService certificationAudienceSyncService;
    private final InvitationAcceptanceOwnerNotificationService invitationOwnerNotifications;
    private final InvitationSenderNotificationService invitationSenderNotifications;

    @Value("#{'${app.hide-creator-emails:}'.toLowerCase().split(',')}")
    private List<String> hiddenCreatorEmails;

    @Value("${app.creator.phones:+79999999999}")
    private String creatorPhonesCsv;

    private Set<String> creatorPhones;

    private static final Duration INVITE_TTL = Duration.ofHours(48);

    @PostConstruct
    void initCreatorPhones() {
        creatorPhones = Arrays.stream(creatorPhonesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    @Override
    @Transactional
    public InviteResponse invite(Long restaurantId, Long currentUserId, InviteRequest req) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        if (req == null) throw new BadRequestException("Invitation request is required");
        String contact = invitationImpactService.validateCandidateIsNotMember(restaurantId, req.phone());

        Instant now = TimeProvider.now();
        invitations.findPendingForUpdateByContact(restaurantId, contact, InvitationStatus.PENDING)
                .ifPresent(existing -> {
                    if (existing.getExpiresAt().isAfter(now)) {
                        throw new ConflictException("Invite already sent to: " + contact);
                    }
                    existing.setStatus(InvitationStatus.EXPIRED);
                    invitations.saveAndFlush(existing);
                    invitationSenderNotifications.submitExpired(
                            existing, BusinessNotificationOperationId.generate());
                });

        Position desiredPosition = invitationImpactService.validatePosition(restaurantId, req.positionId(), currentUserId);

        RestaurantRole desiredRole = desiredPosition.getLevel();

        List<Schedule> discovered = schedules.findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(
                restaurantId, desiredPosition.getId(), restaurantTime.today(restaurant));
        List<Long> relevantIds = discovered.stream().map(Schedule::getId).sorted().toList();
        List<Schedule> relevant = relevantIds.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, relevantIds);
        if (relevant.size() != relevantIds.size()) throw new InvitationImpactPlanStaleException();
        Map<Long, InviteRequest.ScheduleDecision> decisions;
        try {
            decisions = req.scheduleIntents().stream().collect(Collectors.toMap(
                    InviteRequest.ScheduleDecision::scheduleId, Function.identity(),
                    (left, right) -> { throw new IllegalArgumentException(); }, TreeMap::new));
        } catch (RuntimeException ex) {
            throw new BadRequestException("Each relevant schedule must have exactly one decision");
        }
        if (!relevant.stream().map(Schedule::getId).collect(Collectors.toSet()).equals(decisions.keySet())) {
            throw new InvitationImpactPlanStaleException();
        }
        validateDecisions(relevant, decisions, desiredPosition.getId());

        String token = genToken(); // дефолт 24 байта
        Invitation inv = Invitation.builder()
                .restaurant(restaurant)
                .phoneOrEmail(contact)
                .token(token)
                .status(InvitationStatus.PENDING)
                .expiresAt(now.plus(INVITE_TTL))
                .invitedBy(users.findById(currentUserId)
                        .orElseThrow(() -> new NotFoundException("Inviter not found: " + currentUserId)))
                .desiredRole(desiredRole)
                .position(desiredPosition)
                .build();

        inv = invitations.save(inv);
        for (Schedule schedule : relevant) {
            InviteRequest.ScheduleDecision decision = decisions.get(schedule.getId());
            if (decision.selectedAction() == InvitationScheduleIntentAction.ADD_TO_COLLECTION
                    && decision.requestedDeadline() != null) {
                preferenceLifecycle.extendInvitationDeadlineWithLocksHeld(schedule, decision.requestedDeadline());
            } else if (decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION) {
                preferenceLifecycle.prepareInvitationWithLocksHeld(schedule, false, decision.requestedDeadline(),
                        currentUserId, "Новое приглашение сотрудника");
            } else if (decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD) {
                preferenceLifecycle.prepareInvitationWithLocksHeld(schedule, true, decision.requestedDeadline(),
                        currentUserId, "Новое приглашение сотрудника");
            }
            invitationIntents.save(InvitationScheduleIntent.builder()
                    .invitation(inv).schedule(schedule).expectedScheduleId(schedule.getId())
                    .selectedAction(decision.selectedAction())
                    .requestedDeadline(decision.requestedDeadline())
                    // Snapshot the authoritative post-invitation state. Reopen/deadline decisions
                    // are immediate effects and must never be repeated by acceptance.
                    .expectedScheduleVersion(schedule.getVersion())
                    .expectedScheduleStatus(schedule.getStatus())
                    .expectedCollectionCycle(schedule.getPreferenceCollectionCycle())
                    .expectedPreferenceDeadline(schedule.getPreferenceDeadline())
                    .expectedPreferenceMode(schedule.getPreferenceCollectionMode()).build());
        }
        return invitationMapper.toResponse(inv);
    }

    private void validateDecisions(List<Schedule> relevant, Map<Long, InviteRequest.ScheduleDecision> decisions,
                                   Long positionId) {
        Instant now = restaurantTime.nowInstant();
        for (Schedule schedule : relevant) {
            InviteRequest.ScheduleDecision decision = decisions.get(schedule.getId());
            InvitationImpactPlan.ScheduleOpportunity current =
                    invitationImpactService.opportunity(schedule, positionId, now);
            if (!Objects.equals(schedule.getVersion(), decision.expectedScheduleVersion())
                    || schedule.getStatus() != decision.expectedScheduleStatus()
                    || schedule.getPreferenceCollectionCycle() != decision.expectedCollectionCycle()
                    || !Objects.equals(schedule.getPreferenceDeadline(), decision.expectedPreferenceDeadline())
                    || schedule.getPreferenceCollectionMode() != decision.expectedPreferenceMode()
                    || !current.allowedActions().contains(decision.selectedAction())) {
                throw new InvitationImpactPlanStaleException();
            }
            boolean affirmative = decision.selectedAction() == InvitationScheduleIntentAction.ADD_TO_COLLECTION
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD;
            if (affirmative && (!current.targetPositionEligible() || !current.eligibilityProblems().isEmpty())) {
                throw new InvitationImpactPlanStaleException();
            }
            if (decision.selectedAction() == InvitationScheduleIntentAction.ADD_TO_COLLECTION) {
                if (decision.requestedDeadline() != null
                        && (!decision.requestedDeadline().isAfter(now)
                        || schedule.getPreferenceDeadline() == null
                        || decision.requestedDeadline().isBefore(schedule.getPreferenceDeadline()))) {
                    throw new BadRequestException("requestedDeadline must be future and cannot shorten the current deadline");
                }
            } else if (decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD) {
                if (decision.requestedDeadline() == null || !decision.requestedDeadline().isAfter(now)) {
                    throw new BadRequestException("requestedDeadline must be in the future");
                }
            } else if (decision.requestedDeadline() != null) {
                throw new BadRequestException("requestedDeadline is not allowed for this action");
            }
        }
    }

    @Override
    @Transactional(dontRollbackOn = InvitationExpiredException.class)
    public void cancelInvite(Long restaurantId, Long currentUserId, String token) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Invitation inv = invitations.findForUpdateByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));

        if (!inv.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Invite belongs to another restaurant");
        }
        if (inv.getStatus() != InvitationStatus.PENDING) {
            return; // идемпотентно
        }
        if (!inv.getExpiresAt().isAfter(TimeProvider.now())) {
            inv.setStatus(InvitationStatus.EXPIRED);
            invitations.saveAndFlush(inv);
            invitationSenderNotifications.submitExpired(inv, BusinessNotificationOperationId.generate());
            throw new InvitationExpiredException();
        }
        inv.setStatus(InvitationStatus.CANCELED);
        invitations.save(inv);
        User actor = users.findById(currentUserId)
                .orElseThrow(() -> new NotFoundException("User not found: " + currentUserId));
        invitationSenderNotifications.submitCanceled(inv, actor, BusinessNotificationOperationId.generate());
    }

    @Override
    @Transactional(dontRollbackOn = {InvitationInvalidatedException.class, InvitationExpiredException.class})
    public MemberDto acceptInvite(String token, Long currentUserId) {
        Invitation inv = invitations.findForUpdateByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));

        if (inv.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("Invite is not pending");
        }
        User user = users.findById(currentUserId)
                .orElseThrow(() -> new NotFoundException("User not found: " + currentUserId));

        // Контакт должен принадлежать текущему пользователю:
        // - если инвайт на email — у пользователя должен совпасть email (lower)
        // - если на телефон — должен совпасть phone (строго)
        String contact = inv.getPhoneOrEmail();
        boolean matches =
                (isEmail(contact) && user.getEmail() != null
                        && normalizeEmail(user.getEmail()).equals(normalizeEmail(contact)))
                        || (isPhone(contact) && user.getPhone() != null
                        && normalizePhone(user.getPhone()).equals(normalizePhone(contact)));

        if (!matches) {
            throw new ConflictException("Invite not intended for this user");
        }

        if (!inv.getExpiresAt().isAfter(TimeProvider.now())) {
            inv.setStatus(InvitationStatus.EXPIRED);
            invitations.saveAndFlush(inv);
            invitationSenderNotifications.submitExpired(inv, BusinessNotificationOperationId.generate());
            throw new InvitationExpiredException();
        }

        Long restaurantId = inv.getRestaurant().getId();

        RestaurantRole roleToAssign = inv.getDesiredRole() != null ? inv.getDesiredRole() : RestaurantRole.STAFF;
        Position positionToAssign = inv.getPosition();

        if (members.existsByRestaurantIdAndUserId(restaurantId, currentUserId)) {
            invalidate(inv, user, "ALREADY_MEMBER");
        }

        if (positionToAssign == null || !positionToAssign.isActive()
                || !Objects.equals(positionToAssign.getRestaurant().getId(), restaurantId)
                || !isPositionCompatibleWithRole(positionToAssign.getLevel(), roleToAssign)) {
            invalidate(inv, user, "POSITION_UNAVAILABLE");
        }

        List<InvitationScheduleIntent> intents =
                invitationIntents.findByInvitationIdOrderByExpectedScheduleIdAsc(inv.getId());
        List<Long> expectedIds = intents.stream().map(InvitationScheduleIntent::getExpectedScheduleId).toList();
        List<Schedule> lockedSchedules = expectedIds.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, expectedIds);
        Map<Long, Schedule> scheduleById = lockedSchedules.stream()
                .collect(Collectors.toMap(Schedule::getId, Function.identity()));

        for (InvitationScheduleIntent intent : intents) {
            Schedule schedule = scheduleById.get(intent.getExpectedScheduleId());
            if (schedule == null || intent.getSchedule() == null
                    || !Objects.equals(intent.getSchedule().getId(), intent.getExpectedScheduleId())) {
                invalidate(inv, user, "SCHEDULE_DELETED");
            }
            if (!Objects.equals(schedule.getVersion(), intent.getExpectedScheduleVersion())
                    || schedule.getStatus() != intent.getExpectedScheduleStatus()
                    || schedule.getPreferenceCollectionCycle() != intent.getExpectedCollectionCycle()
                    || !Objects.equals(schedule.getPreferenceDeadline(), intent.getExpectedPreferenceDeadline())
                    || schedule.getPreferenceCollectionMode() != intent.getExpectedPreferenceMode()) {
                invalidate(inv, user, "SCHEDULE_CHANGED");
            }
            if (isAddAction(intent.getSelectedAction())) {
                if (schedule.getStatus() != ScheduleStatus.COLLECTING_PREFERENCES
                        || !SchedulePositionIds.ids(schedule).contains(positionToAssign.getId())) {
                    invalidate(inv, user, "COLLECTION_UNAVAILABLE");
                }
                if (schedule.getPreferenceCollectionMode() == PreferenceCollectionMode.SHIFT_OPTIONS
                        && schedule.getPreferenceShiftOptionSnapshots().stream().noneMatch(
                        snapshot -> snapshot.getPositionIds().contains(positionToAssign.getId()))) {
                    invalidate(inv, user, "FROZEN_SHIFT_OPTIONS_UNAVAILABLE");
                }
            }
        }

        // No acceptance mutation is allowed above this line.
        RestaurantMember m = RestaurantMember.builder()
                .user(user)
                .restaurant(inv.getRestaurant())
                .role(roleToAssign)
                .position(positionToAssign)
                .build();
        m = members.save(m);

        List<AppliedInvitationScheduleEffect> appliedScheduleEffects = new ArrayList<>();
        for (InvitationScheduleIntent intent : intents) {
            if (isAddAction(intent.getSelectedAction())) {
                Schedule schedule = scheduleById.get(intent.getExpectedScheduleId());
                boolean created = preferenceLifecycle.addParticipantWithLocksHeld(
                        schedule, m, currentUserId, "Принятие приглашения");
                if (created) {
                    appliedScheduleEffects.add(new AppliedInvitationScheduleEffect(
                            schedule.getId(), schedule.getTitle(),
                            schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId()));
                }
            }
        }
        List<AppliedCertificationAudienceEffect> certificationEffects =
                certificationAudienceSyncService.syncRestaurantAudience(restaurantId, currentUserId);
        inv.setStatus(InvitationStatus.ACCEPTED);
        invitations.save(inv);
        UUID operationId = BusinessNotificationOperationId.generate();
        invitationSenderNotifications.submitAccepted(inv, m, user, operationId);
        invitationOwnerNotifications.submit(m, user, operationId, appliedScheduleEffects, certificationEffects);

        return memberMapper.toDto(m);
    }

    private boolean isAddAction(InvitationScheduleIntentAction action) {
        return action == InvitationScheduleIntentAction.ADD_TO_COLLECTION
                || action == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                || action == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD;
    }

    private void invalidate(Invitation invitation, User actor, String reason) {
        invitation.setStatus(InvitationStatus.INVALIDATED);
        invitations.saveAndFlush(invitation);
        invitationSenderNotifications.submitInvalidated(
                invitation, actor, reason, BusinessNotificationOperationId.generate());
        throw new InvitationInvalidatedException(reason);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<MemberDto> listMembers(Long restaurantId, Long currentUserId) {
        security.assertMember(currentUserId, restaurantId);

        // является ли смотрящий создателем?
        boolean viewerIsCreator = users.findById(currentUserId)
                .map(u -> {
                    String ph = u.getPhone();
                    return ph != null && creatorPhones.contains(ph.trim());
                })
                .orElse(false);

        return members.findByRestaurantId(restaurantId)
                .stream()
                .filter(m -> {
                    if (viewerIsCreator) return true; // создателю показываем всех

                    var u = m.getUser();
                    if (u == null) return true;

                    String ph = u.getPhone();
                    if (ph != null && creatorPhones.contains(ph.trim())) return false;

                    String em = u.getEmail();
                    if (em != null && hiddenCreatorEmails != null &&
                            hiddenCreatorEmails.stream().anyMatch(x -> x.equalsIgnoreCase(em))) {
                        return false;
                    }
                    return true;
                })
                .map(memberMapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public MemberDto updateRole(Long restaurantId, Long memberId, RestaurantRole newRole, Long currentUserId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        RestaurantMember m = members.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (!m.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Member belongs to another restaurant");
        }

        // Нельзя понизить последнего ADMIN
        if (m.getRole() == RestaurantRole.ADMIN && newRole != RestaurantRole.ADMIN) {
            long admins = members.countByRestaurantIdAndRole(restaurantId, RestaurantRole.ADMIN);
            if (admins <= 1) {
                throw new ConflictException("Cannot demote the last ADMIN");
            }
        }

        m.setRole(newRole);
        m = members.save(m);
        return memberMapper.toDto(m);
    }

    @Override
    @Transactional
    public MemberDto updatePosition(Long restaurantId, Long memberId, Long positionId, Long currentUserId) {
        throw new ConflictException("Direct position update is retired; use the atomic position-change command");
    }

    private boolean isPositionCompatibleWithRole(RestaurantRole positionLevel, RestaurantRole role) {
        // ADMIN >= MANAGER >= STAFF
        return switch (role) {
            case ADMIN -> true; // может иметь любую позицию
            case MANAGER -> (positionLevel == RestaurantRole.MANAGER || positionLevel == RestaurantRole.STAFF);
            case STAFF -> (positionLevel == RestaurantRole.STAFF);
        };
    }
}
