package ru.staffly.invite.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
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
import ru.staffly.invite.exception.InvitationExpiredException;
import ru.staffly.invite.dto.InvitationImpactPlan;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.inbox.service.BusinessNotificationOperationId;

import java.time.Duration;
import java.time.Instant;
import java.util.List;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.TreeMap;
import java.util.Objects;
import java.util.function.Function;

import static ru.staffly.common.util.InviteUtils.*;

@Service
@RequiredArgsConstructor
public class InvitationCommandService {
    private final InvitationRepository invitations;
    private final RestaurantRepository restaurants;
    private final UserRepository users;
    private final ScheduleRepository schedules;
    private final InvitationScheduleIntentRepository invitationIntents;
    private final InvitationImpactService invitationImpactService;
    private final RestaurantTimeService restaurantTime;
    private final InvitationMapper invitationMapper;
    private final SecurityService security;
    private final InvitationSenderNotificationService invitationSenderNotifications;
    private final InvitationContactLock contactLock;
    private final ru.staffly.dictionary.repository.PositionRepository positions;
    @org.springframework.beans.factory.annotation.Autowired private ru.staffly.task.service.TaskBoardService taskBoard;
    @org.springframework.beans.factory.annotation.Autowired private ru.staffly.member.lifecycle.RestaurantLifecycleMutex taskMutex;
    private static final Duration INVITE_TTL = Duration.ofHours(48);

    @Transactional
    public InviteResponse invite(Long restaurantId, Long currentUserId, InviteRequest req) {
        if(taskMutex != null) taskMutex.lock(restaurantId);
        security.assertAtLeastManager(currentUserId, restaurantId);

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        if (req == null) throw new BadRequestException("Invitation request is required");
        String contact = invitationImpactService.validateCandidateIsNotMember(restaurantId, req.phone());

        Instant now = TimeProvider.now();
        contactLock.lock(restaurantId, contact);
        // Acceptance holds the same contact lock until commit; the pre-lock check may now be stale.
        invitationImpactService.validateCandidateIsNotMember(restaurantId, contact);
        invitations.findPendingForUpdateByContact(restaurantId, contact, InvitationStatus.PENDING)
                .ifPresent(existing -> {
                    existing.setStatus(existing.getExpiresAt().isAfter(now)
                            ? InvitationStatus.SUPERSEDED : InvitationStatus.EXPIRED);
                    invitations.saveAndFlush(existing);
                    if (existing.getStatus() == InvitationStatus.EXPIRED) {
                        invitationSenderNotifications.submitExpired(existing, BusinessNotificationOperationId.generate());
                    }
                });

        positions.findForShareByIdAndRestaurantId(req.positionId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Position not found"));
        Position desiredPosition = invitationImpactService.validatePosition(restaurantId, req.positionId(), currentUserId);

        RestaurantRole desiredRole = desiredPosition.getLevel();

        List<Schedule> relevant = schedules.findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(
                restaurantId, desiredPosition.getId(), restaurantTime.today(restaurant));
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

        if(taskBoard != null) taskBoard.validateChoices(restaurantId, desiredPosition.getId(), null, req.taskDecisions() == null ? List.of() : req.taskDecisions());
        String token = genToken(); // дефолт 24 байта
        Invitation inv = Invitation.builder()
                .restaurant(restaurant)
                .taskDecisions(req.taskDecisions() == null ? List.of() : req.taskDecisions())
                .phoneOrEmail(contact)
                .token(token)
                .status(InvitationStatus.PENDING)
                .expiresAt(now.plus(INVITE_TTL))
                .invitedBy(users.findById(currentUserId)
                        .orElseThrow(() -> new NotFoundException("Inviter not found: " + currentUserId)))
                .desiredRole(desiredRole)
                .position(desiredPosition)
                .positionSnapshot(ru.staffly.invite.model.AdmissionPositionSnapshot.of(desiredPosition))
                .build();

        inv = invitations.save(inv);
        for (Schedule schedule : relevant) {
            InviteRequest.ScheduleDecision decision = decisions.get(schedule.getId());
            invitationIntents.save(InvitationScheduleIntent.builder()
                    .invitation(inv).schedule(schedule).expectedScheduleId(schedule.getId())
                    .selectedAction(decision.selectedAction())
                    .requestedDeadline(decision.requestedDeadline())
                    // Planning state only; mutations belong to admission.
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
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_TO_DRAFT;
            if (affirmative && (!current.targetPositionEligible() || !current.eligibilityProblems().isEmpty())) {
                throw new InvitationImpactPlanStaleException();
            }
            boolean reopens = decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD;
            boolean acceptsDeadline = reopens
                    || decision.selectedAction() == InvitationScheduleIntentAction.ADD_TO_COLLECTION;
            Instant requestedDeadline = decision.requestedDeadline();
            if (reopens && requestedDeadline == null) {
                throw new BadRequestException("Укажите новый дедлайн для повторного открытия сбора пожеланий.");
            }
            if (requestedDeadline != null) {
                if (!acceptsDeadline) {
                    throw new BadRequestException("Для выбранного действия нельзя указывать дедлайн.");
                }
                if (!requestedDeadline.isAfter(now)) {
                    throw new BadRequestException("Дата и время дедлайна должны быть в будущем.");
                }
                if (schedule.getPreferenceDeadline() != null
                        && requestedDeadline.isBefore(schedule.getPreferenceDeadline())) {
                    throw new BadRequestException("Новый дедлайн не может быть раньше текущего.");
                }
            }
        }
    }

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

}
