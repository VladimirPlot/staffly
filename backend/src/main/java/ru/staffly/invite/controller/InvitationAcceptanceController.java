package ru.staffly.invite.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.invite.dto.MyInviteDto;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.util.List;

import static ru.staffly.common.util.InviteUtils.*;

@RestController
@RequestMapping("/api/invitations")
@RequiredArgsConstructor
public class InvitationAcceptanceController {

    private final EmployeeService employees;
    private final InvitationRepository invitations;
    private final UserRepository users;

    @PreAuthorize("isAuthenticated()")
    @GetMapping("/my")
    public List<MyInviteDto> myInvites(@AuthenticationPrincipal UserPrincipal principal) {
        User me = users.findById(principal.userId())
                .orElseThrow(() -> new NotFoundException("User not found: " + principal.userId()));

        String phone = me.getPhone() != null ? normalizePhone(me.getPhone()) : null;
        String email = me.getEmail() != null ? normalizeEmail(me.getEmail()) : null;

        return invitations.findMyPendingDtos(phone, email, Instant.now(), InvitationStatus.PENDING);
    }

    // Принять инвайт по токену
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{token}/accept")
    public MemberDto accept(@PathVariable String token,
                            @AuthenticationPrincipal UserPrincipal principal) {
        if (token == null || token.isBlank()) throw new BadRequestException("Token required");
        return employees.acceptInvite(token, principal.userId());
    }

    // (опционально) Отклонить — пометим как CANCELED от лица пользователя
    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{token}/decline")
    public void decline(@PathVariable String token,
                        @AuthenticationPrincipal UserPrincipal principal) {
        Invitation inv = invitations.findByToken(token)
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

        if (inv.getStatus() == InvitationStatus.PENDING) {
            inv.setStatus(InvitationStatus.CANCELED);
            invitations.save(inv);
        }
    }
}