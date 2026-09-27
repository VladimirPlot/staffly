package ru.staffly.invite.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.invite.dto.MyInviteDto;
import ru.staffly.invite.exception.InvitationExpiredException;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.invite.service.InvitationSenderNotificationService;
import ru.staffly.inbox.service.BusinessNotificationOperationId;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.util.List;

import static ru.staffly.common.util.InviteUtils.*;

@RestController
@RequestMapping("/api/invitations")
@RequiredArgsConstructor
public class InvitationAcceptanceController {

    private final EmployeeService employees;
    private final InvitationRepository invitations;
    private final UserRepository users;
    private final InvitationSenderNotificationService invitationSenderNotifications;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/my")
    public List<MyInviteDto> myInvites(@AuthenticationPrincipal UserPrincipal principal) {
        User me = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));

        String phone = me.getPhone() != null ? normalizePhone(me.getPhone()) : null;
        String email = me.getEmail() != null ? normalizeEmail(me.getEmail()) : null;

        return invitations.findMyPendingDtos(phone, email, TimeProvider.now(), InvitationStatus.PENDING);
    }

    // Принять инвайт по токену
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{token}/accept")
    public MemberDto accept(@PathVariable String token,
                            @AuthenticationPrincipal UserPrincipal principal) {
        if (token == null || token.isBlank()) throw new BadRequestException("Token required");
        return employees.acceptInvite(token, principal.userId());
    }

    // Explicit employee decision is distinct from manager cancellation.
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{token}/decline")
    @Transactional(noRollbackFor = InvitationExpiredException.class)
    public void decline(@PathVariable String token,
                        @AuthenticationPrincipal UserPrincipal principal) {
        Invitation inv = invitations.findForUpdateByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));

        // простой чек соответствия контакта текущему пользователю
        User me = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));

        String contact = inv.getPhoneOrEmail();
        boolean ok = (isEmail(contact) && me.getEmail() != null
                && normalizeEmail(me.getEmail()).equals(normalizeEmail(contact)))
                || (!isEmail(contact) && me.getPhone() != null
                && normalizePhone(me.getPhone()).equals(normalizePhone(contact)));

        if (!ok) throw new BadRequestException("Invite not intended for this user");

        if (inv.getStatus() != InvitationStatus.PENDING) return;
        if (!inv.getExpiresAt().isAfter(TimeProvider.now())) {
            inv.setStatus(InvitationStatus.EXPIRED);
            invitations.saveAndFlush(inv);
            invitationSenderNotifications.submitExpired(inv, BusinessNotificationOperationId.generate());
            throw new InvitationExpiredException();
        }
        inv.setStatus(InvitationStatus.DECLINED);
        invitations.save(inv);
        invitationSenderNotifications.submitDeclined(inv, me, BusinessNotificationOperationId.generate());
    }
}
