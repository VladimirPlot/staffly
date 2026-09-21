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
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.training.service.CertificationAudienceSyncService;

import java.time.Duration;
import java.time.Instant;
import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;
import java.util.Map;
import java.util.TreeMap;
import java.util.Objects;
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
    private final RestaurantTimeService restaurantTime;

    private final InvitationMapper invitationMapper;
    private final MemberMapper memberMapper;
    private final SecurityService security;
    private final CertificationAudienceSyncService certificationAudienceSyncService;

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

        // уже есть активный инвайт?
        if (invitations.existsInviteForContact(restaurantId, contact, InvitationStatus.PENDING)) {
            throw new ConflictException("Invite already sent to: " + contact);
        }

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
                .expiresAt(TimeProvider.now().plus(INVITE_TTL))
                .invitedBy(users.findById(currentUserId)
                        .orElseThrow(() -> new NotFoundException("Inviter not found: " + currentUserId)))
                .desiredRole(desiredRole)
                .position(desiredPosition)
                .build();

        inv = invitations.save(inv);
        for (Schedule schedule : relevant) {
            InviteRequest.ScheduleDecision decision = decisions.get(schedule.getId());
            invitationIntents.save(InvitationScheduleIntent.builder()
                    .invitation(inv).schedule(schedule).expectedScheduleId(schedule.getId())
                    .selectedAction(decision.selectedAction())
                    .requestedDeadline(decision.requestedDeadline())
                    .expectedScheduleVersion(decision.expectedScheduleVersion())
                    .expectedScheduleStatus(decision.expectedScheduleStatus())
                    .expectedCollectionCycle(decision.expectedCollectionCycle())
                    .expectedPreferenceDeadline(decision.expectedPreferenceDeadline())
                    .expectedPreferenceMode(decision.expectedPreferenceMode()).build());
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
    @Transactional
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
        inv.setStatus(InvitationStatus.CANCELED);
        invitations.save(inv);
    }

    @Override
    @Transactional
    public MemberDto acceptInvite(String token, Long currentUserId) {
        Invitation inv = invitations.findForUpdateByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));

        if (inv.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("Invite is not pending");
        }
        if (TimeProvider.now().isAfter(inv.getExpiresAt())) {
            inv.setStatus(InvitationStatus.EXPIRED);
            invitations.save(inv);
            throw new BadRequestException("Invite expired");
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

        Long restaurantId = inv.getRestaurant().getId();

        RestaurantRole roleToAssign = inv.getDesiredRole() != null ? inv.getDesiredRole() : RestaurantRole.STAFF;
        Position positionToAssign = inv.getPosition();

        if (members.existsByRestaurantIdAndUserId(restaurantId, currentUserId)) {
            inv.setStatus(InvitationStatus.ACCEPTED);
            invitations.save(inv);
            RestaurantMember m = members.findByUserIdAndRestaurantId(currentUserId, restaurantId).get();
            return memberMapper.toDto(m);
        }

        // на всякий случай перепроверим согласованность, если инвайт старый
        if (positionToAssign != null && !isPositionCompatibleWithRole(positionToAssign.getLevel(), roleToAssign)) {
            throw new ConflictException("Stored invitation position is incompatible with role");
        }

        RestaurantMember m = RestaurantMember.builder()
                .user(user)
                .restaurant(inv.getRestaurant())
                .role(roleToAssign)
                .position(positionToAssign)
                .build();
        m = members.save(m);

        inv.setStatus(InvitationStatus.ACCEPTED);
        invitations.save(inv);
        certificationAudienceSyncService.syncRestaurantAudience(restaurantId);

        return memberMapper.toDto(m);
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
