package ru.staffly.member.service;

import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.restaurant.model.RestaurantRole;

import java.util.List;

public interface EmployeeService {
    InviteResponse invite(Long restaurantId, Long currentUserId, InviteRequest req);
    void cancelInvite(Long restaurantId, Long currentUserId, String token);
    MemberDto acceptInvite(String token, Long currentUserId);
    List<MemberDto> listMembers(Long restaurantId, Long currentUserId);
    MemberDto updateRole(Long restaurantId, Long memberId, RestaurantRole newRole, Long currentUserId);
    void removeMember(Long restaurantId, Long memberId, Long currentUserId);
}