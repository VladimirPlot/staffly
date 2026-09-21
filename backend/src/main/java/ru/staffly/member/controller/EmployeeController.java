package ru.staffly.member.controller;

import jakarta.validation.Valid;
import lombok.RequiredArgsConstructor;
import org.springframework.security.access.prepost.PreAuthorize;
import org.springframework.security.core.annotation.AuthenticationPrincipal;
import org.springframework.web.bind.annotation.*;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.invite.dto.InvitationImpactPlan;
import ru.staffly.invite.dto.InvitationImpactRequest;
import ru.staffly.invite.service.InvitationImpactService;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.dto.ApplyPositionChangeRequest;
import ru.staffly.member.dto.ApplyPositionChangeResult;
import ru.staffly.member.dto.PositionChangeImpactPlan;
import ru.staffly.member.dto.PositionChangeImpactRequest;
import ru.staffly.member.dto.UpdateMemberRoleRequest;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest;
import ru.staffly.member.dto.ApplyEmployeeRemovalResult;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffOptionsDto;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffRequest;
import ru.staffly.member.responsibility.MemberResponsibilityHandoffService;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.member.service.EmployeeRemovalImpactService;
import ru.staffly.member.service.EmployeeRemovalApplyService;
import ru.staffly.member.service.PositionChangeImpactService;
import ru.staffly.member.service.PositionChangeApplyService;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.security.UserPrincipal;

import java.util.List;

@RestController
@RequestMapping("/api/restaurants/{restaurantId}")
@RequiredArgsConstructor
public class EmployeeController {

    private final EmployeeService employees;
    private final MemberResponsibilityHandoffService responsibilityHandoffService;
    private final PositionChangeImpactService positionChangeImpactService;
    private final PositionChangeApplyService positionChangeApplyService;
    private final EmployeeRemovalImpactService employeeRemovalImpactService;
    private final EmployeeRemovalApplyService employeeRemovalApplyService;
    private final InvitationImpactService invitationImpactService;

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/invitations/impact")
    public InvitationImpactPlan invitationImpact(@PathVariable Long restaurantId,
                                                 @AuthenticationPrincipal UserPrincipal principal,
                                                 @Valid @RequestBody InvitationImpactRequest request) {
        return invitationImpactService.calculate(restaurantId, principal.userId(), request);
    }

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

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/members/{memberId}/position-change-impact")
    public PositionChangeImpactPlan positionChangeImpact(@PathVariable Long restaurantId,
                                                          @PathVariable Long memberId,
                                                          @AuthenticationPrincipal UserPrincipal principal,
                                                          @Valid @RequestBody PositionChangeImpactRequest request) {
        return positionChangeImpactService.calculate(restaurantId, memberId, request.targetPositionId(),
                principal.userId());
    }

    @PreAuthorize("@securityService.hasAtLeastManager(principal.userId, #restaurantId)")
    @PostMapping("/members/{memberId}/position-change")
    public ApplyPositionChangeResult applyPositionChange(@PathVariable Long restaurantId,
                                                          @PathVariable Long memberId,
                                                          @AuthenticationPrincipal UserPrincipal principal,
                                                          @Valid @RequestBody ApplyPositionChangeRequest request) {
        return positionChangeApplyService.apply(restaurantId, memberId, request, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/members/{memberId}/removal-impact")
    public EmployeeRemovalImpactPlan removalImpact(@PathVariable Long restaurantId,
                                                    @PathVariable Long memberId,
                                                    @AuthenticationPrincipal UserPrincipal principal) {
        return employeeRemovalImpactService.calculate(restaurantId, memberId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/members/{memberId}/remove")
    public ApplyEmployeeRemovalResult remove(@PathVariable Long restaurantId,
                                              @PathVariable Long memberId,
                                              @AuthenticationPrincipal UserPrincipal principal,
                                              @Valid @RequestBody ApplyEmployeeRemovalRequest request) {
        return employeeRemovalApplyService.apply(restaurantId, memberId, request, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @GetMapping("/members/{memberId}/responsibility-handoff-options")
    public MemberResponsibilityHandoffOptionsDto responsibilityHandoffOptions(@PathVariable Long restaurantId,
                                                                               @PathVariable Long memberId,
                                                                               @AuthenticationPrincipal UserPrincipal principal) {
        return responsibilityHandoffService.getHandoffOptions(restaurantId, memberId, principal.userId());
    }

    @PreAuthorize("@securityService.isMember(principal.userId, #restaurantId)")
    @PostMapping("/members/{memberId}/responsibility-handoff")
    public void responsibilityHandoff(@PathVariable Long restaurantId,
                                      @PathVariable Long memberId,
                                      @AuthenticationPrincipal UserPrincipal principal,
                                      @Valid @RequestBody MemberResponsibilityHandoffRequest request) {
        responsibilityHandoffService.handoff(restaurantId, memberId, principal.userId(), request);
    }

}
