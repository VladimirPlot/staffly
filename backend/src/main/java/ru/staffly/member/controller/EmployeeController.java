package ru.staffly.member.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.dto.UpdateMemberPositionRequest;
import ru.staffly.member.dto.UpdateMemberRoleRequest;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employees;

    // Пригласить по телефону/email (MANAGER/OWNER)
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/members/invite")
    public InviteResponse invite(@PathVariable Long restaurantId,
                                 @AuthenticationPrincipal UserPrincipal principal,
                                 @Valid @RequestBody InviteRequest req) {
        return employees.invite(restaurantId, principal.userId(), req);
    }

    // Отменить инвайт (MANAGER/OWNER)
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @DeleteMapping("/invitations/{token}")
    public void cancelInvite(@PathVariable Long restaurantId,
                             @PathVariable String token,
                             @AuthenticationPrincipal UserPrincipal principal) {
        employees.cancelInvite(restaurantId, principal.userId(), token);
    }

    // Список членов ресторана (любой MEMBER)
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/members")
    public List<MemberDto> list(@PathVariable Long restaurantId,
                                @AuthenticationPrincipal UserPrincipal principal) {
        return employees.listMembers(restaurantId, principal.userId());
    }

    // Обновить роль (MANAGER/OWNER)
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/members/{memberId}/role")
    public MemberDto updateRole(@PathVariable Long restaurantId,
                                @PathVariable Long memberId,
                                @AuthenticationPrincipal UserPrincipal principal,
                                @Valid @RequestBody UpdateMemberRoleRequest req) {
        RestaurantRole newRole = req.role();
        return employees.updateRole(restaurantId, memberId, newRole, principal.userId());
    }

    // Обновить должность (MANAGER/OWNER)
    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PatchMapping("/members/{memberId}/position")
    public MemberDto updatePosition(@PathVariable Long restaurantId,
                                    @PathVariable Long memberId,
                                    @AuthenticationPrincipal UserPrincipal principal,
                                    @RequestBody UpdateMemberPositionRequest req) {
        return employees.updatePosition(restaurantId, memberId, req.positionId(), principal.userId());
    }

    // Удалить участника (правила зависят от роли — проверяются в сервисе)
    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @DeleteMapping("/members/{memberId}")
    public void remove(@PathVariable Long restaurantId,
                       @PathVariable Long memberId,
                       @AuthenticationPrincipal UserPrincipal principal) {
        employees.removeMember(restaurantId, memberId, principal.userId());
    }
}