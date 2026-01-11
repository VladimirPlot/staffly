package ru.staffly.anonymousletter.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.anonymousletter.dto.AnonymousLetterDto;
import ru.staffly.anonymousletter.dto.AnonymousLetterRequest;
import ru.staffly.anonymousletter.dto.AnonymousLetterSummaryDto;
import ru.staffly.anonymousletter.dto.UnreadLettersDto;
import ru.staffly.anonymousletter.mapper.AnonymousLetterMapper;
import ru.staffly.anonymousletter.model.AnonymousLetter;
import ru.staffly.anonymousletter.repository.AnonymousLetterRepository;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.time.LocalDate;
import java.util.List;

@Service
@RequiredArgsConstructor
public class AnonymousLetterServiceImpl implements AnonymousLetterService {

    private final AnonymousLetterRepository letters;
    private final RestaurantRepository restaurants;
    private final UserRepository users;
    private final RestaurantMemberRepository members;
    private final AnonymousLetterMapper mapper;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<AnonymousLetterSummaryDto> list(Long restaurantId, Long currentUserId) {
        security.assertMember(currentUserId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        if (member.getRole() == RestaurantRole.ADMIN) {
            return letters.findByRestaurantIdAndRecipientIdOrderByCreatedAtDesc(restaurantId, member.getId())
                    .stream()
                    .map(mapper::toSummary)
                    .toList();
        }

        return letters.findByRestaurantIdAndSenderIdOrderByCreatedAtDesc(restaurantId, currentUserId)
                .stream()
                .map(mapper::toSummary)
                .toList();
    }

    @Override
    @Transactional
    public AnonymousLetterDto get(Long restaurantId, Long currentUserId, Long letterId) {
        security.assertMember(currentUserId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        AnonymousLetter letter = letters.findByIdAndRestaurantId(letterId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Письмо не найдено"));

        if (member.getRole() == RestaurantRole.ADMIN) {
            if (!letter.getRecipient().getId().equals(member.getId())) {
                throw new ForbiddenException("Нет доступа к письму");
            }
            if (letter.getReadAt() == null) {
                letter.setReadAt(restaurantTime.nowInstant());
                letters.save(letter);
            }
            return mapper.toDto(letter);
        }

        if (!letter.getSender().getId().equals(currentUserId)) {
            throw new ForbiddenException("Нет доступа к письму");
        }

        return mapper.toDto(letter);
    }

    @Override
    @Transactional
    public AnonymousLetterDto create(Long restaurantId, Long currentUserId, AnonymousLetterRequest request) {
        security.assertMember(currentUserId, restaurantId);
        RestaurantMember senderMember = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));

        if (senderMember.getRole() == RestaurantRole.ADMIN) {
            throw new ForbiddenException("Отправка писем доступна сотрудникам и менеджерам");
        }

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        User sender = users.findById(currentUserId)
                .orElseThrow(() -> new NotFoundException("User not found: " + currentUserId));

        RestaurantMember recipient = members.findById(request.recipientMemberId())
                .orElseThrow(() -> new BadRequestException("Получатель не найден"));
        if (!recipient.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Получатель принадлежит другому ресторану");
        }
        if (recipient.getRole() != RestaurantRole.ADMIN) {
            throw new BadRequestException("Получателем может быть только ADMIN");
        }

        String subject = normalize(request.subject());
        if (subject == null || subject.isBlank()) {
            throw new BadRequestException("Введите тему письма");
        }

        String content = normalize(request.content());
        if (content == null || content.isBlank()) {
            throw new BadRequestException("Напишите письмо");
        }

        LocalDate today = restaurantTime.today(restaurant);
        Instant dayStart = restaurantTime.startOfDay(restaurant, today);
        Instant dayEnd = restaurantTime.startOfDay(restaurant, today.plusDays(1));

        if (letters.existsByRestaurantIdAndSenderIdAndCreatedAtBetween(restaurantId, currentUserId, dayStart, dayEnd)) {
            throw new BadRequestException("Можно отправлять только одно письмо в день");
        }

        AnonymousLetter letter = AnonymousLetter.builder()
                .restaurant(restaurant)
                .sender(sender)
                .recipient(recipient)
                .subject(subject)
                .content(content)
                .build();

        letter = letters.save(letter);
        return mapper.toDto(letter);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public UnreadLettersDto hasUnread(Long restaurantId, Long currentUserId) {
        security.assertAdmin(currentUserId, restaurantId);
        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));
        long unread = letters.countByRestaurantIdAndRecipientIdAndReadAtIsNull(restaurantId, member.getId());
        return new UnreadLettersDto(unread > 0);
    }

    private String normalize(String value) {
        return value == null ? null : value.trim();
    }
}