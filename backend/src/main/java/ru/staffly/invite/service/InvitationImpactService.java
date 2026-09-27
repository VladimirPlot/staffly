package ru.staffly.invite.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.invite.dto.InvitationImpactPlan;
import ru.staffly.invite.dto.InvitationImpactRequest;
import ru.staffly.invite.model.InvitationScheduleIntentAction;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.repository.UserRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.*;

import static ru.staffly.common.util.InviteUtils.isPhone;
import static ru.staffly.common.util.InviteUtils.normalizePhone;

@Service
@RequiredArgsConstructor
public class InvitationImpactService {
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final ScheduleRepository schedules;
    private final UserRepository users;
    private final RestaurantMemberRepository members;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;

    @Transactional(Transactional.TxType.SUPPORTS)
    public InvitationImpactPlan calculate(Long restaurantId, Long actorUserId, InvitationImpactRequest request) {
        security.assertAtLeastManager(actorUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        String phone = validateCandidateIsNotMember(restaurantId, request.phone());
        Position position = validatePosition(restaurantId, request.positionId(), actorUserId);
        Instant now = restaurantTime.nowInstant();

        List<InvitationImpactPlan.ScheduleOpportunity> opportunities = schedules
                .findByRestaurantIdAndPositionIdAndEndDateGreaterThanEqualOrderByIdAsc(
                        restaurantId, position.getId(), restaurantTime.today(restaurant))
                .stream().map(schedule -> opportunity(schedule, position.getId(), now)).toList();

        return new InvitationImpactPlan(now,
                new InvitationImpactPlan.Candidate(phone, position.getId(), position.getName(), position.getLevel()),
                opportunities);
    }

    public Position validatePosition(Long restaurantId, Long positionId, Long actorUserId) {
        Position position = positions.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position not found: " + positionId));
        if (!Objects.equals(position.getRestaurant().getId(), restaurantId) || !position.isActive()) {
            throw new BadRequestException("Position is not in this restaurant or inactive");
        }
        if (!security.isAdmin(actorUserId, restaurantId) && position.getLevel() != RestaurantRole.STAFF) {
            throw new ForbiddenException("Managers can invite only STAFF positions");
        }
        return position;
    }

    public String validateCandidateIsNotMember(Long restaurantId, String rawPhone) {
        if (!isPhone(rawPhone)) throw new BadRequestException("Invalid phone");
        String phone = normalizePhone(rawPhone);
        users.findByPhone(phone).ifPresent(user -> {
            if (members.existsByRestaurantIdAndUserId(restaurantId, user.getId())) {
                throw new ConflictException("User already a member");
            }
        });
        return phone;
    }

    public InvitationImpactPlan.ScheduleOpportunity opportunity(Schedule schedule, Long positionId, Instant now) {
        Hibernate.initialize(schedule.getPreferenceShiftOptionSnapshots());
        boolean preferenceLifecycle = schedule.getStatus() == ScheduleStatus.COLLECTING_PREFERENCES
                || schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED
                || schedule.getStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES;
        boolean shiftOptionsRequired = preferenceLifecycle
                && schedule.getPreferenceCollectionMode() == PreferenceCollectionMode.SHIFT_OPTIONS;
        List<Long> snapshotIds = schedule.getPreferenceShiftOptionSnapshots().stream()
                .filter(snapshot -> {
                    Hibernate.initialize(snapshot.getPositionIds());
                    return snapshot.getPositionIds().contains(positionId);
                }).map(SchedulePreferenceShiftOptionSnapshot::getId).sorted().toList();
        boolean vocabularyAvailable = !shiftOptionsRequired || !snapshotIds.isEmpty();
        List<InvitationImpactPlan.EligibilityProblem> problems = new ArrayList<>();
        if (preferenceLifecycle && schedule.getPreferenceCollectionMode() == null) {
            problems.add(InvitationImpactPlan.EligibilityProblem.MISSING_PREFERENCE_MODE);
        }
        if (!vocabularyAvailable) {
            problems.add(InvitationImpactPlan.EligibilityProblem.MISSING_FROZEN_SHIFT_OPTIONS_FOR_POSITION);
        }
        List<InvitationScheduleIntentAction> actions = switch (schedule.getStatus()) {
            case COLLECTING_PREFERENCES -> List.of(InvitationScheduleIntentAction.ADD_TO_COLLECTION,
                    InvitationScheduleIntentAction.DO_NOT_ADD);
            case PREFERENCES_CLOSED -> List.of(InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION,
                    InvitationScheduleIntentAction.DO_NOT_ADD);
            case DRAFT_FROM_PREFERENCES -> List.of(InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD,
                    InvitationScheduleIntentAction.DO_NOT_ADD);
            case DRAFT, PUBLISHED -> List.of(InvitationScheduleIntentAction.INFORMATION_ONLY);
        };
        Instant deadline = schedule.getPreferenceDeadline();
        boolean lessThanSixHours = deadline != null && deadline.isAfter(now)
                && Duration.between(now, deadline).compareTo(Duration.ofHours(6)) < 0;
        return new InvitationImpactPlan.ScheduleOpportunity(schedule.getId(), schedule.getTitle(), schedule.getStatus(),
                schedule.getVersion(), schedule.getPreferenceCollectionCycle(), deadline, actions,
                schedule.getPreferenceCollectionMode(), true, shiftOptionsRequired, vocabularyAvailable,
                schedule.getPreferenceBuildTemplate() == null ? null : schedule.getPreferenceBuildTemplate().getId(),
                snapshotIds, List.copyOf(problems),
                schedule.getStatus() == ScheduleStatus.PREFERENCES_CLOSED
                        || schedule.getStatus() == ScheduleStatus.DRAFT_FROM_PREFERENCES,
                lessThanSixHours);
    }
}
