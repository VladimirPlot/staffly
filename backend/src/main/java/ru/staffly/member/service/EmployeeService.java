package ru.staffly.member.service;

import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.member.dto.MemberDto;

import java.util.List;

public interface EmployeeService {
    InviteResponse invite(Long restaurantId, Long currentUserId, InviteRequest req);
    void cancelInvite(Long restaurantId, Long currentUserId, String token);
    MemberDto acceptInvite(String token, Long currentUserId);
    List<MemberDto> listMembers(Long restaurantId, Long currentUserId);
    MemberDto updatePosition(Long restaurantId, Long memberId, Long positionId, Long currentUserId);
}
