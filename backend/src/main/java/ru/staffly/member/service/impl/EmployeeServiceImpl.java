package ru.staffly.member.service.impl;

import jakarta.annotation.PostConstruct;
import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.stereotype.Service;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.security.SecurityService;
import ru.staffly.user.repository.UserRepository;

import java.util.Arrays;
import java.util.List;
import java.util.Set;
import java.util.stream.Collectors;


@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final ru.staffly.invite.service.InvitationCommandService invitationCommands;
    private final ru.staffly.member.lifecycle.AdmissionCoordinator admission;
    private final RestaurantMemberRepository members;
    private final UserRepository users;
    private final MemberMapper memberMapper;
    private final SecurityService security;

    @Value("#{'${app.hide-creator-emails:}'.toLowerCase().split(',')}")
    private List<String> hiddenCreatorEmails;

    @Value("${app.creator.phones:+79999999999}")
    private String creatorPhonesCsv;

    private Set<String> creatorPhones;


    @PostConstruct
    void initCreatorPhones() {
        creatorPhones = Arrays.stream(creatorPhonesCsv.split(","))
                .map(String::trim)
                .filter(s -> !s.isEmpty())
                .collect(Collectors.toSet());
    }

    @Override
    public InviteResponse invite(Long restaurantId, Long currentUserId, InviteRequest req) {
        return invitationCommands.invite(restaurantId, currentUserId, req);
    }
    @Override
    public void cancelInvite(Long restaurantId, Long currentUserId, String token) {
        invitationCommands.cancelInvite(restaurantId, currentUserId, token);
    }
    @Override
    public MemberDto acceptInvite(String token, Long currentUserId) {
        return admission.acceptInvite(token, currentUserId);
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

        return members.findByRestaurantIdAndEndedAtIsNull(restaurantId)
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


}
