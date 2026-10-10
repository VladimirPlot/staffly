package ru.staffly.reminder.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.reminder.dto.ReminderDto;
import ru.staffly.reminder.dto.ReminderRequest;
import ru.staffly.reminder.mapper.ReminderMapper;
import ru.staffly.reminder.model.Reminder;
import ru.staffly.reminder.model.ReminderPeriodicity;
import ru.staffly.reminder.model.ReminderTargetType;
import ru.staffly.reminder.repository.ReminderRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.List;
import java.util.Locale;
import java.util.Objects;

@Service
@RequiredArgsConstructor
public class ReminderServiceImpl implements ReminderService {

    private static final DateTimeFormatter TIME_FORMAT = DateTimeFormatter.ofPattern("HH:mm");

    private final ReminderRepository reminders;
    private final RestaurantRepository restaurants;
    private final RestaurantMemberRepository members;
    private final PositionRepository positions;
    private final ReminderMapper mapper;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;
    private final RestaurantLifecycleMutex lifecycleMutex;

    @Override
    @Transactional
    public List<ReminderDto> list(Long restaurantId, Long currentUserId, List<String> globalRoles, Long positionFilterId) {
        security.assertMember(currentUserId, restaurantId);

        RestaurantMember member = members.findActiveByUserIdAndRestaurantId(currentUserId, restaurantId).orElse(null);
        boolean isCreator = hasRole(globalRoles, "CREATOR");
        boolean canManage = isCreator || (member != null && isManagerOrAdmin(member));
        Long myPositionId = member != null && member.getPosition() != null ? member.getPosition().getId() : null;

        List<Reminder> entities = reminders.findDetailedByRestaurantId(restaurantId);

        return entities.stream()
                .filter(reminder -> isVisible(reminder, canManage, member, myPositionId))
                .filter(reminder -> matchesPositionFilter(reminder, canManage, positionFilterId))
                .map(mapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public ReminderDto create(Long restaurantId, Long currentUserId, ReminderRequest request) {
        lifecycleMutex.lock(restaurantId);
        security.assertMember(currentUserId, restaurantId);

        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        RestaurantMember member = members.findActiveByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));

        boolean canManage = isManagerOrAdmin(member);

        Targets targets = resolveTargets(restaurantId, member, canManage, request);

        ReminderPeriodicity periodicity = parsePeriodicity(request.periodicity());
        LocalTime time = parseTime(request.time());
        validateMinutes(time);

        String title = normalize(request.title());
        if (title == null || title.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }

        Reminder reminder = Reminder.builder()
                .restaurant(restaurant)
                .title(title)
                .description(normalize(request.description()))
                .createdByMember(member)
                .visibleToAdmin(resolveVisibleToAdminForCreate(canManage, request.visibleToAdmin()))
                .targetType(targets.type())
                .targetPositions(new java.util.LinkedHashSet<>(targets.positions()))
                .targetMembers(new java.util.LinkedHashSet<>(targets.members()))
                .periodicity(periodicity)
                .time(time)
                .active(true)
                .build();

        applyScheduleFields(reminder, request);

        ZoneId zone = restaurantTime.zoneFor(restaurant);
        Instant now = restaurantTime.nowInstant();
        Instant nextFireAt = computeNextFireOrThrow(reminder, zone, now, true);
        reminder.setNextFireAt(nextFireAt);

        Reminder saved = reminders.save(reminder);
        return mapper.toDto(saved);
    }

    @Override
    @Transactional
    public ReminderDto update(Long restaurantId, Long currentUserId, Long reminderId, ReminderRequest request) {
        lifecycleMutex.lock(restaurantId);
        security.assertMember(currentUserId, restaurantId);

        Reminder reminder = reminders.findByIdAndRestaurantId(reminderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Reminder not found"));
        RestaurantMember member = members.findActiveByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
        boolean canManage = isManagerOrAdmin(member);
        boolean isOwner = reminder.getCreatedByMember() != null
                && Objects.equals(reminder.getCreatedByMember().getId(), member.getId());

        if (!canManage && !isOwner) {
            throw new ForbiddenException("Недостаточно прав");
        }
        if (canManage && !reminder.isVisibleToAdmin() && !isOwner) {
            throw new ForbiddenException("Недостаточно прав");
        }

        Targets targets = resolveTargets(restaurantId, member, canManage, request);

        String title = normalize(request.title());
        if (title == null || title.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }
        reminder.setTitle(title);
        reminder.setDescription(normalize(request.description()));
        reminder.setVisibleToAdmin(resolveVisibleToAdminForUpdate(canManage, reminder, request.visibleToAdmin()));
        reminder.setTargetType(targets.type());
        reminder.setTargetPosition(null);
        reminder.setTargetMember(null);
        reminder.getTargetPositions().clear();
        reminder.getTargetPositions().addAll(targets.positions());
        reminder.getTargetMembers().clear();
        reminder.getTargetMembers().addAll(targets.members());

        ReminderPeriodicity periodicity = parsePeriodicity(request.periodicity());
        LocalTime time = parseTime(request.time());
        validateMinutes(time);
        reminder.setPeriodicity(periodicity);
        reminder.setTime(time);

        applyScheduleFields(reminder, request);

        ZoneId zone = restaurantTime.zoneFor(reminder.getRestaurant());
        Instant now = restaurantTime.nowInstant();
        Instant nextFireAt = computeNextFireOrThrow(reminder, zone, now, true);
        reminder.setNextFireAt(nextFireAt);
        reminder.setActive(true);

        Reminder saved = reminders.save(reminder);
        return mapper.toDto(saved);
    }

    @Override
    @Transactional
    public void delete(Long restaurantId, Long currentUserId, Long reminderId) {
        security.assertMember(currentUserId, restaurantId);

        Reminder reminder = reminders.findByIdAndRestaurantId(reminderId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Reminder not found"));
        RestaurantMember member = members.findActiveByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));

        boolean canManage = isManagerOrAdmin(member);
        boolean isOwner = reminder.getCreatedByMember() != null
                && Objects.equals(reminder.getCreatedByMember().getId(), member.getId());

        if (!canManage && !isOwner) {
            throw new ForbiddenException("Недостаточно прав");
        }
        if (canManage && !reminder.isVisibleToAdmin() && !isOwner) {
            throw new ForbiddenException("Недостаточно прав");
        }

        reminders.delete(reminder);
    }

    private boolean isVisible(Reminder reminder, boolean canManage, RestaurantMember member, Long myPositionId) {
        if (reminder == null) {
            return false;
        }
        boolean isOwner = member != null && reminder.getCreatedByMember() != null
                && Objects.equals(reminder.getCreatedByMember().getId(), member.getId());
        if (isOwner) {
            return true;
        }
        if (canManage) {
            return reminder.isVisibleToAdmin();
        }
        if (reminder.getTargetType() == ReminderTargetType.ALL) {
            return true;
        }
        if (reminder.getTargetType() == ReminderTargetType.POSITION) {
            return myPositionId != null
                    && reminder.effectivePositions().stream().anyMatch(position -> Objects.equals(position.getId(), myPositionId));
        }
        if (reminder.getTargetType() == ReminderTargetType.MEMBER) {
            return member != null
                    && reminder.effectiveMembers().stream().anyMatch(target -> Objects.equals(target.getId(), member.getId()));
        }
        return false;
    }

    private boolean matchesPositionFilter(Reminder reminder, boolean canManage, Long positionFilterId) {
        if (!canManage || positionFilterId == null) {
            return true;
        }
        if (reminder.getTargetType() == ReminderTargetType.ALL) {
            return true;
        }
        if (reminder.getTargetType() == ReminderTargetType.POSITION) {
            return reminder.effectivePositions().stream().anyMatch(position -> Objects.equals(position.getId(), positionFilterId));
        }
        if (reminder.getTargetType() == ReminderTargetType.MEMBER) {
            return reminder.effectiveMembers().stream().anyMatch(target -> target.getPosition() != null
                    && Objects.equals(target.getPosition().getId(), positionFilterId));
        }
        return true;
    }

    private ReminderTargetType parseTargetType(String targetType) {
        if (targetType == null || targetType.isBlank()) {
            throw new BadRequestException("Укажите получателя");
        }
        try {
            return ReminderTargetType.valueOf(targetType.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Некорректный тип получателя");
        }
    }

    private record Targets(ReminderTargetType type, List<Position> positions, List<RestaurantMember> members) {}

    private List<Long> targetIds(List<Long> ids, Long legacyId) {
        List<Long> result = ids != null ? ids : legacyId == null ? List.of() : List.of(legacyId);
        if (result.stream().anyMatch(id -> id == null || id <= 0)) {
            throw new BadRequestException("Некорректные идентификаторы получателей");
        }
        return result.stream().distinct().toList();
    }

    private Targets resolveTargets(Long restaurantId, RestaurantMember actor, boolean canManage, ReminderRequest request) {
        ReminderTargetType type = parseTargetType(request.targetType());
        List<Long> positionIds = targetIds(request.targetPositionIds(), request.targetPositionId());
        List<Long> memberIds = targetIds(request.targetMemberIds(), request.targetMemberId());
        if (!canManage) {
            if (type != ReminderTargetType.MEMBER || !positionIds.isEmpty()
                    || memberIds.stream().anyMatch(id -> !Objects.equals(id, actor.getId()))) {
                throw new BadRequestException("Можно создавать напоминания только для себя");
            }
            return new Targets(ReminderTargetType.MEMBER, List.of(), List.of(actor));
        }
        if (type == ReminderTargetType.ALL) {
            if (!positionIds.isEmpty() || !memberIds.isEmpty()) {
                throw new BadRequestException("Для отправки всем не нужно выбирать получателей");
            }
            return new Targets(type, List.of(), List.of());
        }
        if (type == ReminderTargetType.POSITION) {
            if (positionIds.isEmpty() || !memberIds.isEmpty()) {
                throw new BadRequestException("Выберите должности без ограничения по сотрудникам");
            }
            return new Targets(type, positionIds.stream().map(id -> resolvePosition(restaurantId, id)).toList(), List.of());
        }
        if (memberIds.isEmpty()) throw new BadRequestException("Выберите сотрудников");
        List<RestaurantMember> targets = memberIds.stream().map(id -> resolveMember(restaurantId, id)).toList();
        // Positions constrain selection only; personal reminders follow the membership after a position change.
        positionIds.forEach(id -> resolvePosition(restaurantId, id));
        if (!positionIds.isEmpty() && targets.stream().anyMatch(target -> target.getPosition() == null
                || !positionIds.contains(target.getPosition().getId()))) {
            throw new BadRequestException("Состав сотрудников изменился. Проверьте выбранные должности и получателей.");
        }
        return new Targets(type, List.of(), targets);
    }

    private ReminderPeriodicity parsePeriodicity(String periodicity) {
        if (periodicity == null || periodicity.isBlank()) {
            throw new BadRequestException("Периодичность обязательна");
        }
        try {
            return ReminderPeriodicity.valueOf(periodicity.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Неизвестная периодичность");
        }
    }

    private LocalTime parseTime(String time) {
        if (time == null || time.isBlank()) {
            throw new BadRequestException("Укажите время напоминания");
        }
        try {
            return LocalTime.parse(time.trim(), TIME_FORMAT);
        } catch (Exception ex) {
            throw new BadRequestException("Некорректное время");
        }
    }

    private void validateMinutes(LocalTime time) {
        if (time == null) {
            return;
        }
        int minute = time.getMinute();
        if (minute != 0 && minute != 15 && minute != 30 && minute != 45) {
            throw new BadRequestException("Минуты должны быть кратны 15");
        }
    }

    private void applyScheduleFields(Reminder reminder, ReminderRequest request) {
        reminder.setDayOfWeek(null);
        reminder.setDayOfMonth(null);
        reminder.setMonthlyLastDay(false);
        reminder.setOnceDate(null);

        ReminderPeriodicity periodicity = reminder.getPeriodicity();
        if (periodicity == ReminderPeriodicity.WEEKLY) {
            Integer dow = request.dayOfWeek();
            if (dow == null || dow < 1 || dow > 7) {
                throw new BadRequestException("Укажите день недели");
            }
            reminder.setDayOfWeek(dow);
            return;
        }
        if (periodicity == ReminderPeriodicity.MONTHLY) {
            boolean lastDay = Boolean.TRUE.equals(request.monthlyLastDay());
            reminder.setMonthlyLastDay(lastDay);
            if (lastDay) {
                reminder.setDayOfMonth(31);
                return;
            }
            Integer dom = request.dayOfMonth();
            if (dom == null || dom < 1 || dom > 31) {
                throw new BadRequestException("Укажите день месяца");
            }
            reminder.setDayOfMonth(dom);
            return;
        }
        if (periodicity == ReminderPeriodicity.ONCE) {
            String dateValue = request.onceDate();
            if (dateValue == null || dateValue.isBlank()) {
                throw new BadRequestException("Укажите дату напоминания");
            }
            try {
                reminder.setOnceDate(LocalDate.parse(dateValue.trim()));
            } catch (Exception ex) {
                throw new BadRequestException("Некорректная дата");
            }
        }
    }

    private Instant computeNextFireOrThrow(Reminder reminder, ZoneId zone, Instant now, boolean validateOnceFuture) {
        Instant next = ReminderScheduleCalculator.computeNextFire(now, reminder, zone);
        if (reminder.getPeriodicity() == ReminderPeriodicity.ONCE) {
            if (next == null) {
                throw new BadRequestException("Укажите дату напоминания");
            }
            if (validateOnceFuture && next.isBefore(now)) {
                throw new BadRequestException("Дата напоминания уже прошла");
            }
        } else if (next == null) {
            throw new BadRequestException("Не удалось вычислить следующее напоминание");
        }
        return next;
    }

    private Position resolvePosition(Long restaurantId, Long positionId) {
        if (positionId == null) {
            throw new BadRequestException("Укажите должность");
        }
        Position position = positions.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position not found"));
        if (!Objects.equals(position.getRestaurant().getId(), restaurantId)) {
            throw new BadRequestException("Должность не принадлежит ресторану");
        }
        return position;
    }

    private RestaurantMember resolveMember(Long restaurantId, Long memberId) {
        if (memberId == null) {
            throw new BadRequestException("Укажите сотрудника");
        }
        RestaurantMember member = members.findByIdAndEndedAtIsNull(memberId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
        if (!Objects.equals(member.getRestaurant().getId(), restaurantId)) {
            throw new BadRequestException("Сотрудник не принадлежит ресторану");
        }
        return member;
    }

    private boolean isManagerOrAdmin(RestaurantMember member) {
        if (member == null || member.getRole() == null) {
            return false;
        }
        return member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;
    }

    private boolean hasRole(List<String> globalRoles, String role) {
        if (globalRoles == null || role == null) {
            return false;
        }
        return globalRoles.stream().anyMatch(r -> role.equalsIgnoreCase(r));
    }

    private String normalize(String value) {
        if (value == null) {
            return null;
        }
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }

    private boolean resolveVisibleToAdminForCreate(boolean canManage, Boolean visibleToAdmin) {
        if (canManage) {
            return true;
        }
        return visibleToAdmin == null || visibleToAdmin;
    }

    private boolean resolveVisibleToAdminForUpdate(boolean canManage, Reminder reminder, Boolean visibleToAdmin) {
        if (canManage) {
            return true;
        }
        if (visibleToAdmin == null) {
            return reminder.isVisibleToAdmin();
        }
        return visibleToAdmin;
    }
}
