package ru.staffly.invite.controller;

import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.security.UserPrincipal;

@RestController
@RequestMapping("/api/invitations")
@RequiredArgsConstructor
public class InvitationAcceptanceController {

    private final EmployeeService employees;

    @PreAuthorize("isAuthenticated()")
    @PostMapping("/{token}/accept")
    public MemberDto accept(@PathVariable String token,
                            @AuthenticationPrincipal UserPrincipal principal) {
        return employees.acceptInvite(token, principal.userId());
    }
}