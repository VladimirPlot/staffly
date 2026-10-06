package ru.staffly.member.lifecycle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.invite.exception.*;
import ru.staffly.invite.service.*;
import ru.staffly.inbox.service.BusinessNotificationOperationId;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import ru.staffly.user.repository.UserRepository;
import java.util.*;
import static ru.staffly.common.util.InviteUtils.*;

/** Lock order: RestaurantLifecycleMutex -> InvitationContactLock -> Invitation -> Position share -> Schedule ASC -> Certification ASC. */
@Service
@RequiredArgsConstructor
public class AdmissionCoordinator {
    private final List<AdmissionLifecycleHandler> handlers;
    private final RestaurantLifecycleMutex mutex;
    private final InvitationContactLock contactLock;
    private final InvitationRepository invitations;
    private final PositionRepository positions;
    private final RestaurantMemberRepository members;
    private final UserRepository users;
    private final MemberMapper memberMapper;
    private final RestaurantTimeService time;
    private final InvitationSenderNotificationService senderNotifications;
    private final InvitationAcceptanceOwnerNotificationService ownerNotifications;

    @jakarta.annotation.PostConstruct
    void validateUniqueHandlers() {
        Set<LifecycleModule> modules = EnumSet.noneOf(LifecycleModule.class);
        for (var handler : handlers) {
            if (!modules.add(handler.module())) {
                throw new IllegalStateException("Duplicate admission lifecycle handler for " + handler.module());
            }
        }
    }

    @Transactional(noRollbackFor = {InvitationInvalidatedException.class, InvitationExpiredException.class})
    public MemberDto acceptInvite(String token, Long userId) {
        // Scalar lookup avoids loading stale invitation/position entities before waiting on the mutex.
        var identity = invitations.findAdmissionIdentityByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));
        Long restaurantId = identity.getRestaurantId();
        String canonicalContact = isEmail(identity.getContact())
                ? normalizeEmail(identity.getContact()) : normalizePhone(identity.getContact());
        mutex.lock(restaurantId);
        contactLock.lock(restaurantId, canonicalContact);
        Invitation inv = invitations.findForUpdateByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));
        var user = users.findById(userId).orElseThrow(() -> new NotFoundException("User not found"));
        String contact = inv.getPhoneOrEmail();
        boolean matches = (isEmail(contact) && user.getEmail() != null
                && normalizeEmail(contact).equals(normalizeEmail(user.getEmail())))
                || (isPhone(contact) && user.getPhone() != null
                && normalizePhone(contact).equals(normalizePhone(user.getPhone())));
        if (!matches) throw new ConflictException("Invite not intended for this user");
        if (inv.getStatus() == InvitationStatus.ACCEPTED && inv.getAcceptedMember() != null
                && Objects.equals(inv.getAcceptedMember().getUser().getId(), userId)) {
            return memberMapper.toDto(inv.getAcceptedMember());
        }
        if (inv.getStatus() == InvitationStatus.INVALIDATED || inv.getStatus() == InvitationStatus.SUPERSEDED) {
            throw new InvitationInvalidatedException("TERMINAL_PLAN");
        }
        if (inv.getStatus() == InvitationStatus.EXPIRED) throw new InvitationExpiredException();
        if (inv.getStatus() != InvitationStatus.PENDING) throw new ConflictException("Invite is not pending");
        var now = time.nowInstant();
        var operationId = BusinessNotificationOperationId.generate();
        if (!inv.getExpiresAt().isAfter(now)) {
            inv.setStatus(InvitationStatus.EXPIRED);
            invitations.saveAndFlush(inv);
            senderNotifications.submitExpired(inv, operationId);
            throw new InvitationExpiredException();
        }
        AdmissionApplyContext context;
        List<AdmissionLifecycleHandler.PreparedAdmission> prepared = new ArrayList<>();
        try {
            if (members.existsByRestaurantIdAndUserIdAndEndedAtIsNull(restaurantId, userId)) {
                throw new AdmissionPlanInvalidException("ALREADY_MEMBER");
            }
            if (inv.getPositionSnapshot() == null || inv.getPosition() == null) {
                throw new AdmissionPlanInvalidException("POSITION_UNAVAILABLE");
            }
            var position = positions.findForShareByIdAndRestaurantId(inv.getPosition().getId(), restaurantId)
                    .orElseThrow(() -> new AdmissionPlanInvalidException("POSITION_UNAVAILABLE"));
            if (!position.isActive() || !inv.getPositionSnapshot().equals(AdmissionPositionSnapshot.of(position))) {
                throw new AdmissionPlanInvalidException("POSITION_CHANGED");
            }
            context = new AdmissionApplyContext(inv, user, position, now, operationId);
            for (var handler : handlers.stream().sorted(Comparator.comparingInt(AdmissionLifecycleHandler::getOrder)).toList()) {
                prepared.add(handler.prepare(context));
            }
        } catch (AdmissionPlanInvalidException ex) {
            inv.setStatus(InvitationStatus.INVALIDATED);
            invitations.saveAndFlush(inv);
            senderNotifications.submitInvalidated(inv, user, ex.getMessage(), operationId);
            throw new InvitationInvalidatedException(ex.getMessage());
        }
        var member = members.save(RestaurantMember.builder().restaurant(inv.getRestaurant()).user(user)
                .position(context.position()).startedAt(context.operationNow()).build());
        var scheduleEffects = new ArrayList<AppliedInvitationScheduleEffect>();
        var certificationEffects = new ArrayList<AppliedCertificationAudienceEffect>();
        for (var preparation : prepared) {
            var result = preparation.applyAfterMembershipCreated(member);
            scheduleEffects.addAll(result.scheduleEffects());
            certificationEffects.addAll(result.certificationEffects());
        }
        inv.setAcceptedMember(member);
        inv.setStatus(InvitationStatus.ACCEPTED);
        invitations.save(inv);
        senderNotifications.submitAccepted(inv, member, user, operationId);
        ownerNotifications.submit(member, user, operationId, scheduleEffects, certificationEffects);
        return memberMapper.toDto(member);
    }
}
