package ru.staffly.member.service.impl;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.invite.dto.InviteRequest;
import ru.staffly.invite.dto.InviteResponse;
import ru.staffly.invite.mapper.InvitationMapper;
import ru.staffly.invite.model.Invitation;
import ru.staffly.invite.model.InvitationStatus;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.member.dto.MemberDto;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Duration;
import java.time.Instant;
import java.util.List;

import static ru.staffly.common.util.InviteUtils.*;

@Service
@RequiredArgsConstructor
public class EmployeeServiceImpl implements EmployeeService {

    private final InvitationRepository invitations;
    private final RestaurantMemberRepository members;
    private final RestaurantRepository restaurants;
    private final UserRepository users;

    private final InvitationMapper invitationMapper;
    private final MemberMapper memberMapper;
    private final SecurityService security;

    private static final Duration INVITE_TTL = Duration.ofHours(48);

    @Override
    @Transactional
    public InviteResponse invite(Long restaurantId, Long currentUserId, InviteRequest req) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        if (req == null || !isValidContact(req.phoneOrEmail())) {
            throw new BadRequestException("Invalid phoneOrEmail");
        }

        // нормализуем для консистентности
        String contact = isEmail(req.phoneOrEmail())
                ? normalizeEmail(req.phoneOrEmail())
                : normalizePhone(req.phoneOrEmail());

        // уже есть активный инвайт?
        if (invitations.existsInviteForContact(restaurantId, contact, InvitationStatus.PENDING)) {
            throw new ConflictException("Invite already sent to: " + contact);
        }

        // если контакт уже член ресторана — конфликт
        users.findByPhoneOrEmail(contact).ifPresent(u -> {
            if (members.existsByRestaurantIdAndUserId(restaurantId, u.getId())) {
                throw new ConflictException("User already a member");
            }
        });

        String token = genToken(); // дефолт 24 байта
        Invitation inv = Invitation.builder()
                .restaurant(restaurant)
                .phoneOrEmail(contact)
                .token(token)
                .status(InvitationStatus.PENDING)
                .expiresAt(Instant.now().plus(INVITE_TTL))
                .invitedBy(users.findById(currentUserId)
                        .orElseThrow(() -> new NotFoundException("Inviter not found: " + currentUserId)))
                .build();

        inv = invitations.save(inv);
        return invitationMapper.toResponse(inv);
    }

    @Override
    @Transactional
    public void cancelInvite(Long restaurantId, Long currentUserId, String token) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Invitation inv = invitations.findByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));

        if (!inv.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Invite belongs to another restaurant");
        }
        if (inv.getStatus() != InvitationStatus.PENDING) {
            return; // идемпотентно
        }
        inv.setStatus(InvitationStatus.CANCELED);
        invitations.save(inv);
    }

    @Override
    @Transactional
    public MemberDto acceptInvite(String token, Long currentUserId) {
        Invitation inv = invitations.findByToken(token)
                .orElseThrow(() -> new NotFoundException("Invite not found"));

        if (inv.getStatus() != InvitationStatus.PENDING) {
            throw new ConflictException("Invite is not pending");
        }
        if (Instant.now().isAfter(inv.getExpiresAt())) {
            inv.setStatus(InvitationStatus.EXPIRED);
            invitations.save(inv);
            throw new BadRequestException("Invite expired");
        }

        User user = users.findById(currentUserId)
                .orElseThrow(() -> new NotFoundException("User not found: " + currentUserId));

        // Контакт должен принадлежать текущему пользователю:
        // - если инвайт на email — у пользователя должен совпасть email (lower)
        // - если на телефон — должен совпасть phone (строго)
        String contact = inv.getPhoneOrEmail();
        boolean matches =
                (isEmail(contact) && user.getEmail() != null
                        && normalizeEmail(user.getEmail()).equals(normalizeEmail(contact)))
                        || (isPhone(contact) && user.getPhone() != null
                        && normalizePhone(user.getPhone()).equals(normalizePhone(contact)));

        if (!matches) {
            throw new ConflictException("Invite not intended for this user");
        }

        Long restaurantId = inv.getRestaurant().getId();

        if (members.existsByRestaurantIdAndUserId(restaurantId, currentUserId)) {
            inv.setStatus(InvitationStatus.ACCEPTED);
            invitations.save(inv);
            RestaurantMember m = members.findByUserIdAndRestaurantId(currentUserId, restaurantId).get();
            return memberMapper.toDto(m);
        }

        RestaurantMember m = RestaurantMember.builder()
                .user(user)
                .restaurant(inv.getRestaurant())
                .role(RestaurantRole.STAFF) // дефолт
                .build();
        m = members.save(m);

        inv.setStatus(InvitationStatus.ACCEPTED);
        invitations.save(inv);

        return memberMapper.toDto(m);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<MemberDto> listMembers(Long restaurantId, Long currentUserId) {
        security.assertMember(currentUserId, restaurantId);
        return members.findByRestaurantId(restaurantId)
                .stream().map(memberMapper::toDto).toList();
    }

    @Override
    @Transactional
    public MemberDto updateRole(Long restaurantId, Long memberId, RestaurantRole newRole, Long currentUserId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        RestaurantMember m = members.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (!m.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Member belongs to another restaurant");
        }

        // Нельзя понизить последнего ADMIN
        if (m.getRole() == RestaurantRole.ADMIN && newRole != RestaurantRole.ADMIN) {
            long admins = members.countByRestaurantIdAndRole(restaurantId, RestaurantRole.ADMIN);
            if (admins <= 1) {
                throw new ConflictException("Cannot demote the last ADMIN");
            }
        }

        m.setRole(newRole);
        m = members.save(m);
        return memberMapper.toDto(m);
    }

    @Override
    @Transactional
    public void removeMember(Long restaurantId, Long memberId, Long currentUserId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        RestaurantMember m = members.findById(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found: " + memberId));
        if (!m.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Member belongs to another restaurant");
        }

        // Нельзя удалить последнего ADMIN
        if (m.getRole() == RestaurantRole.ADMIN) {
            long admins = members.countByRestaurantIdAndRole(restaurantId, RestaurantRole.ADMIN);
            if (admins <= 1) {
                throw new ConflictException("Cannot remove the last ADMIN");
            }
        }
        members.deleteById(memberId);
    }
}