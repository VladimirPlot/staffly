package ru.staffly.checklist.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.mapper.ChecklistMapper;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.model.ChecklistItem;
import ru.staffly.checklist.model.ChecklistKind;
import ru.staffly.checklist.model.ChecklistPeriodicity;
import ru.staffly.checklist.repository.ChecklistRepository;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.time.DayOfWeek;
import java.time.Instant;
import java.time.LocalDate;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.ZonedDateTime;
import java.time.format.DateTimeFormatter;
import java.time.temporal.TemporalAdjusters;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChecklistServiceImpl implements ChecklistService {

    private static final ZoneId RESET_ZONE = ZoneId.of("UTC");

    private final ChecklistRepository checklists;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final RestaurantMemberRepository members;
    private final ChecklistMapper mapper;
    private final SecurityService security;

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ChecklistDto> list(Long restaurantId, Long currentUserId, List<String> globalRoles, Long positionFilterId) {
        security.assertMember(currentUserId, restaurantId);

        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId).orElse(null);
        boolean isCreator = hasRole(globalRoles, "CREATOR");
        boolean canManage = isCreator || (member != null && isManagerOrAdmin(member));
        Long myPositionId = member != null && member.getPosition() != null ? member.getPosition().getId() : null;

        Long effectiveFilter;
        if (canManage) {
            effectiveFilter = positionFilterId;
        } else {
            effectiveFilter = myPositionId;
            if (effectiveFilter == null) {
                return List.of();
            }
        }

        Long finalEffectiveFilter = effectiveFilter;
        return checklists.findByRestaurantIdOrderByKindDescNameAsc(restaurantId).stream()
                .filter(cl -> {
                    Set<Long> positionIds = cl.getPositions().stream().map(Position::getId).collect(Collectors.toSet());
                    if (!canManage) {
                        return positionIds.contains(finalEffectiveFilter);
                    }
                    if (finalEffectiveFilter != null) {
                        return positionIds.contains(finalEffectiveFilter);
                    }
                    return true;
                })
                .peek(this::applyLazyResetIfNeeded)
                .map(mapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public ChecklistDto create(Long restaurantId, Long currentUserId, ChecklistRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        ChecklistKind kind = parseKind(request.kind());
        String name = normalize(request.name());
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }

        ChecklistPeriodicity periodicity = parsePeriodicity(request.periodicity(), kind);
        LocalTime resetTime = parseResetTime(request.resetTime());
        Integer resetDayOfWeek = request.resetDayOfWeek();
        Integer resetDayOfMonth = request.resetDayOfMonth();
        List<String> items = request.items();

        String content;
        if (kind == ChecklistKind.INFO) {
            content = normalizeContent(request.content());
            if (content == null || content.trim().isEmpty()) {
                throw new BadRequestException("Содержимое обязательно");
            }
        } else {
            content = normalizeContent(request.content());
        }

        validateTrackable(kind, periodicity, resetTime, resetDayOfWeek, resetDayOfMonth, items);

        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());

        Checklist entity = Checklist.builder()
                .restaurant(restaurant)
                .name(name)
                .content(content)
                .kind(kind)
                .periodicity(periodicity)
                .resetTime(resetTime)
                .resetDayOfWeek(resetDayOfWeek)
                .resetDayOfMonth(resetDayOfMonth)
                .lastResetAt(Instant.now())
                .completed(false)
                .build();
        mapper.applyPositions(entity, new HashSet<>(targetPositions));

        if (kind == ChecklistKind.TRACKABLE) {
            applyItems(entity, items);
        }

        entity = checklists.save(entity);
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public ChecklistDto update(Long restaurantId, Long currentUserId, Long checklistId, ChecklistRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist entity = checklists.findDetailedById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }

        ChecklistKind kind = parseKind(request.kind());
        String name = normalize(request.name());
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }

        ChecklistPeriodicity periodicity = parsePeriodicity(request.periodicity(), kind);
        LocalTime resetTime = parseResetTime(request.resetTime());
        Integer resetDayOfWeek = request.resetDayOfWeek();
        Integer resetDayOfMonth = request.resetDayOfMonth();
        List<String> items = request.items();

        String content;
        if (kind == ChecklistKind.INFO) {
            content = normalizeContent(request.content());
            if (content == null || content.trim().isEmpty()) {
                throw new BadRequestException("Содержимое обязательно");
            }
        } else {
            content = normalizeContent(request.content());
        }

        validateTrackable(kind, periodicity, resetTime, resetDayOfWeek, resetDayOfMonth, items);

        entity.setName(name);
        entity.setContent(content);
        entity.setKind(kind);
        entity.setPeriodicity(periodicity);
        entity.setResetTime(resetTime);
        entity.setResetDayOfWeek(resetDayOfWeek);
        entity.setResetDayOfMonth(resetDayOfMonth);
        if (entity.getLastResetAt() == null) {
            entity.setLastResetAt(Instant.now());
        }
        if (kind == ChecklistKind.INFO) {
            entity.getItems().clear();
            entity.setCompleted(false);
        } else {
            applyItems(entity, items);
            entity.setCompleted(entity.getItems().stream().allMatch(ChecklistItem::isDone));
        }

        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());
        mapper.applyPositions(entity, new HashSet<>(targetPositions));
        entity = checklists.save(entity);
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public ChecklistDto updateProgress(Long restaurantId, Long currentUserId, Long checklistId, List<Long> itemIds) {
        security.assertMember(currentUserId, restaurantId);
        Checklist checklist = checklists.findDetailedById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!Objects.equals(checklist.getRestaurant().getId(), restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            throw new BadRequestException("Можно отмечать только проверяемые чек-листы");
        }

        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
        boolean canManage = isManagerOrAdmin(member);
        Long myPositionId = member.getPosition() != null ? member.getPosition().getId() : null;
        Set<Long> positionIds = checklist.getPositions().stream().map(Position::getId).collect(Collectors.toSet());
        if (!canManage) {
            if (myPositionId == null || !positionIds.contains(myPositionId)) {
                throw new NotFoundException("Checklist not available");
            }
        }

        applyLazyResetIfNeeded(checklist);

        Set<Long> targetIds = itemIds == null ? Set.of() : itemIds.stream().filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> knownIds = checklist.getItems().stream().map(ChecklistItem::getId).collect(Collectors.toSet());
        if (!knownIds.containsAll(targetIds)) {
            throw new BadRequestException("Некоторые пункты не найдены");
        }

        Instant now = Instant.now();
        for (ChecklistItem item : checklist.getItems()) {
            if (!item.isDone() && targetIds.contains(item.getId())) {
                item.setDone(true);
                item.setDoneAt(now);
                item.setDoneBy(member);
            }
        }
        boolean allDone = checklist.getItems().stream().allMatch(ChecklistItem::isDone);
        checklist.setCompleted(allDone);
        checklist = checklists.save(checklist);
        return mapper.toDto(checklist);
    }

    @Override
    @Transactional
    public ChecklistDto reset(Long restaurantId, Long currentUserId, Long checklistId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist checklist = checklists.findDetailedById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!Objects.equals(checklist.getRestaurant().getId(), restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            throw new BadRequestException("Можно сбросить только проверяемый чек-лист");
        }
        resetChecklist(checklist, Instant.now());
        checklist = checklists.save(checklist);
        return mapper.toDto(checklist);
    }

    @Override
    @Transactional
    public void delete(Long restaurantId, Long currentUserId, Long checklistId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist entity = checklists.findById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        checklists.delete(entity);
    }

    private boolean hasRole(List<String> roles, String expected) {
        if (roles == null || roles.isEmpty()) return false;
        String target = expected.toUpperCase(Locale.ROOT);
        return roles.stream()
                .filter(r -> r != null && !r.isBlank())
                .map(r -> r.toUpperCase(Locale.ROOT).replace("ROLE_", ""))
                .anyMatch(r -> r.equals(target));
    }

    private boolean isManagerOrAdmin(RestaurantMember member) {
        return member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;
    }

    private List<Position> resolvePositions(Long restaurantId, List<Long> ids) {
        if (ids == null || ids.isEmpty()) {
            return List.of();
        }
        List<Long> distinctIds = ids.stream().filter(id -> id != null && id > 0).distinct().toList();
        if (distinctIds.isEmpty()) {
            return List.of();
        }
        List<Position> found = positions.findAllById(distinctIds);
        if (found.size() != distinctIds.size()) {
            throw new BadRequestException("Некоторые должности не найдены");
        }
        for (Position position : found) {
            if (!position.getRestaurant().getId().equals(restaurantId)) {
                throw new BadRequestException("Должность принадлежит другому ресторану");
            }
        }
        return found;
    }

    private String normalize(String s) {
        return s == null ? null : s.trim();
    }

    private String normalizeContent(String s) {
        if (s == null) {
            return null;
        }
        return s.replace("\r\n", "\n");
    }

    private ChecklistKind parseKind(String kind) {
        if (kind == null || kind.isBlank()) {
            return ChecklistKind.INFO;
        }
        try {
            return ChecklistKind.valueOf(kind.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Неизвестный тип чек-листа");
        }
    }

    private ChecklistPeriodicity parsePeriodicity(String periodicity, ChecklistKind kind) {
        if (kind != ChecklistKind.TRACKABLE) {
            return null;
        }
        if (periodicity == null || periodicity.isBlank()) {
            throw new BadRequestException("Периодичность обязательна");
        }
        try {
            return ChecklistPeriodicity.valueOf(periodicity.trim().toUpperCase(Locale.ROOT));
        } catch (IllegalArgumentException ex) {
            throw new BadRequestException("Неизвестная периодичность");
        }
    }

    private LocalTime parseResetTime(String resetTime) {
        if (resetTime == null || resetTime.isBlank()) {
            return null;
        }
        try {
            return LocalTime.parse(resetTime, DateTimeFormatter.ofPattern("HH:mm"));
        } catch (Exception ex) {
            throw new BadRequestException("Некорректное время сброса");
        }
    }

    private void validateTrackable(ChecklistKind kind,
                                   ChecklistPeriodicity periodicity,
                                   LocalTime resetTime,
                                   Integer resetDayOfWeek,
                                   Integer resetDayOfMonth,
                                   List<String> items) {
        if (kind != ChecklistKind.TRACKABLE) {
            return;
        }
        if (periodicity != ChecklistPeriodicity.MANUAL && resetTime == null) {
            throw new BadRequestException("Укажите время сброса");
        }
        if (periodicity == ChecklistPeriodicity.WEEKLY) {
            if (resetDayOfWeek == null || resetDayOfWeek < 1 || resetDayOfWeek > 7) {
                throw new BadRequestException("Укажите день недели");
            }
        }
        if (periodicity == ChecklistPeriodicity.MONTHLY) {
            if (resetDayOfMonth == null || resetDayOfMonth < 1 || resetDayOfMonth > 31) {
                throw new BadRequestException("Укажите день месяца");
            }
        }
        if (items == null || items.stream().map(this::normalize).filter(s -> s != null && !s.isBlank()).count() == 0) {
            throw new BadRequestException("Добавьте хотя бы один пункт");
        }
    }

    private void applyItems(Checklist entity, List<String> itemTexts) {
        entity.getItems().clear();
        if (itemTexts == null) {
            return;
        }
        int order = 1;
        for (String raw : itemTexts) {
            String text = normalize(raw);
            if (text == null || text.isBlank()) {
                continue;
            }
            ChecklistItem item = ChecklistItem.builder()
                    .checklist(entity)
                    .itemOrder(order++)
                    .text(text)
                    .done(false)
                    .build();
            entity.getItems().add(item);
        }
        entity.setCompleted(false);
    }

    private void applyLazyResetIfNeeded(Checklist checklist) {
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            return;
        }
        ChecklistPeriodicity periodicity = checklist.getPeriodicity();
        if (periodicity == null || periodicity == ChecklistPeriodicity.MANUAL) {
            return;
        }
        Instant last = checklist.getLastResetAt() != null ? checklist.getLastResetAt() : checklist.getCreatedAt();
        if (last == null) {
            last = Instant.now();
        }
        Instant next = computeNextReset(last, checklist);
        boolean updated = false;
        Instant now = Instant.now();
        while (next != null && !next.isAfter(now)) {
            resetChecklist(checklist, next);
            updated = true;
            next = computeNextReset(checklist.getLastResetAt(), checklist);
        }
        if (updated) {
            checklists.save(checklist);
        }
    }

    private void resetChecklist(Checklist checklist, Instant moment) {
        for (ChecklistItem item : checklist.getItems()) {
            item.setDone(false);
            item.setDoneBy(null);
            item.setDoneAt(null);
        }
        checklist.setCompleted(false);
        checklist.setLastResetAt(moment != null ? moment : Instant.now());
    }

    private Instant computeNextReset(Instant base, Checklist checklist) {
        ChecklistPeriodicity periodicity = checklist.getPeriodicity();
        LocalTime resetTime = checklist.getResetTime();
        if (periodicity == null || periodicity == ChecklistPeriodicity.MANUAL || resetTime == null) {
            return null;
        }

        ZonedDateTime from = base.atZone(RESET_ZONE);
        return switch (periodicity) {
            case DAILY -> ZonedDateTime.of(from.toLocalDate().plusDays(1), resetTime, RESET_ZONE).toInstant();
            case WEEKLY -> {
                Integer dow = checklist.getResetDayOfWeek();
                if (dow == null || dow < 1 || dow > 7) {
                    yield null;
                }
                DayOfWeek target = DayOfWeek.of(dow);
                ZonedDateTime candidate = ZonedDateTime.of(from.toLocalDate(), resetTime, RESET_ZONE)
                        .with(TemporalAdjusters.nextOrSame(target));
                if (!candidate.toInstant().isAfter(base)) {
                    candidate = candidate.plusWeeks(1);
                }
                yield candidate.toInstant();
            }
            case MONTHLY -> {
                Integer dom = checklist.getResetDayOfMonth();
                if (dom == null || dom < 1 || dom > 31) {
                    yield null;
                }
                LocalDate startDate = from.toLocalDate();
                int day = Math.min(dom, startDate.lengthOfMonth());
                ZonedDateTime candidate = ZonedDateTime.of(startDate.withDayOfMonth(day), resetTime, RESET_ZONE);
                if (!candidate.toInstant().isAfter(base)) {
                    LocalDate nextMonth = startDate.plusMonths(1);
                    int nextDay = Math.min(dom, nextMonth.lengthOfMonth());
                    candidate = ZonedDateTime.of(nextMonth.withDayOfMonth(nextDay), resetTime, RESET_ZONE);
                }
                yield candidate.toInstant();
            }
            case MANUAL -> null;
        };
    }
}