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
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.text.Collator;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChecklistServiceImpl implements ChecklistService {

    private final ChecklistRepository checklists;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final RestaurantMemberRepository members;
    private final ChecklistMapper mapper;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ChecklistDto> list(
            Long restaurantId,
            Long currentUserId,
            List<String> globalRoles,
            Long positionFilterId,
            ChecklistKind kind,
            String query
    ) {
        security.assertMember(currentUserId, restaurantId);

        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId).orElse(null);
        boolean isCreator = hasRole(globalRoles, "CREATOR");
        boolean canManage = isCreator || (member != null && isManagerOrAdmin(member));
        Long myPositionId = member != null && member.getPosition() != null ? member.getPosition().getId() : null;

        Long effectiveFilter = canManage ? positionFilterId : myPositionId;
        if (!canManage && effectiveFilter == null) {
            return List.of();
        }

        String normalizedQuery = normalizeQuery(query);
        List<Checklist> visible = new ArrayList<>(
                checklists.findListDetailedByRestaurantId(restaurantId, effectiveFilter, kind, normalizedQuery)
        );

        List<Checklist> updated = new ArrayList<>();
        for (Checklist checklist : visible) {
            if (applyLazyResetIfNeeded(checklist)) {
                updated.add(checklist);
            }
        }
        if (!updated.isEmpty()) {
            checklists.saveAll(updated);
        }

        sortChecklists(visible, kind);

        return visible.stream().map(mapper::toDto).toList();
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
                .lastResetAt(restaurantTime.nowInstant())
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
            entity.setLastResetAt(restaurantTime.nowInstant());
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
    public ChecklistDto reserveItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId) {
        ChecklistContext context = loadChecklistContext(restaurantId, currentUserId, checklistId);
        ChecklistItem item = findChecklistItem(context.checklist(), itemId);
        if (item.isDone()) {
            throw new BadRequestException("Нельзя бронировать выполненный пункт");
        }
        if (item.getReservedBy() != null && !item.getReservedBy().getId().equals(context.member().getId())) {
            throw new ConflictException("Пункт забронирован другим сотрудником");
        }
        item.setReservedBy(context.member());
        item.setReservedAt(restaurantTime.nowInstant());
        return mapper.toDto(checklists.save(context.checklist()));
    }

    @Override
    @Transactional
    public ChecklistDto unreserveItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId) {
        ChecklistContext context = loadChecklistContext(restaurantId, currentUserId, checklistId);
        ChecklistItem item = findChecklistItem(context.checklist(), itemId);
        if (item.getReservedBy() == null) {
            return mapper.toDto(context.checklist());
        }
        if (!item.getReservedBy().getId().equals(context.member().getId()) && !context.canManage()) {
            throw new ConflictException("Пункт забронирован другим сотрудником");
        }
        item.setReservedBy(null);
        item.setReservedAt(null);
        return mapper.toDto(checklists.save(context.checklist()));
    }

    @Override
    @Transactional
    public ChecklistDto completeItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId) {
        ChecklistContext context = loadChecklistContext(restaurantId, currentUserId, checklistId);
        ChecklistItem item = findChecklistItem(context.checklist(), itemId);
        if (item.getReservedBy() != null && !item.getReservedBy().getId().equals(context.member().getId())) {
            throw new ConflictException("Пункт забронирован другим сотрудником");
        }
        if (!item.isDone()) {
            item.setDone(true);
            item.setDoneAt(restaurantTime.nowInstant());
            item.setDoneBy(context.member());
            item.setReservedBy(null);
            item.setReservedAt(null);
        }
        context.checklist().setCompleted(context.checklist().getItems().stream().allMatch(ChecklistItem::isDone));
        return mapper.toDto(checklists.save(context.checklist()));
    }

    @Override
    @Transactional
    public ChecklistDto undoItem(Long restaurantId, Long currentUserId, Long checklistId, Long itemId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        ChecklistContext context = loadChecklistContext(restaurantId, currentUserId, checklistId);
        ChecklistItem item = findChecklistItem(context.checklist(), itemId);
        item.setDone(false);
        item.setDoneAt(null);
        item.setDoneBy(null);
        item.setReservedBy(null);
        item.setReservedAt(null);
        context.checklist().setCompleted(context.checklist().getItems().stream().allMatch(ChecklistItem::isDone));
        return mapper.toDto(checklists.save(context.checklist()));
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
        resetChecklist(checklist, restaurantTime.nowInstant());
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

    private void sortChecklists(List<Checklist> checklists, ChecklistKind kind) {
        Collator collator = Collator.getInstance(new Locale("ru", "RU"));
        collator.setStrength(Collator.PRIMARY);

        Comparator<Checklist> byName = Comparator.comparing(Checklist::getName, Comparator.nullsLast(collator));
        if (kind == ChecklistKind.TRACKABLE) {
            checklists.sort(Comparator.comparing(Checklist::isCompleted).thenComparing(byName));
            return;
        }
        if (kind == ChecklistKind.INFO) {
            checklists.sort(byName);
            return;
        }
        checklists.sort(Comparator.comparingInt(this::checklistGroupKey).thenComparing(byName));
    }

    private String normalizeQuery(String query) {
        String normalized = normalize(query);
        return normalized == null || normalized.isBlank() ? null : normalized;
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

    private ChecklistContext loadChecklistContext(Long restaurantId, Long currentUserId, Long checklistId) {
        security.assertMember(currentUserId, restaurantId);
        Checklist checklist = checklists.findDetailedById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!Objects.equals(checklist.getRestaurant().getId(), restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            throw new BadRequestException("Можно работать только с проверяемыми чек-листами");
        }
        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Member not found"));
        boolean canManage = isManagerOrAdmin(member);
        assertChecklistAccess(checklist, member, canManage);
        if (applyLazyResetIfNeeded(checklist)) {
            checklists.save(checklist);
        }
        return new ChecklistContext(checklist, member, canManage);
    }

    private void assertChecklistAccess(Checklist checklist, RestaurantMember member, boolean canManage) {
        if (canManage) {
            return;
        }
        Long myPositionId = member.getPosition() != null ? member.getPosition().getId() : null;
        Set<Long> positionIds = checklist.getPositions().stream().map(Position::getId).collect(Collectors.toSet());
        if (myPositionId == null || !positionIds.contains(myPositionId)) {
            throw new NotFoundException("Checklist not available");
        }
    }

    private ChecklistItem findChecklistItem(Checklist checklist, Long itemId) {
        return checklist.getItems().stream()
                .filter(item -> Objects.equals(item.getId(), itemId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Checklist item not found: " + itemId));
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
        List<String> normalizedItems = itemTexts == null
                ? List.of()
                : itemTexts.stream()
                .map(this::normalize)
                .filter(text -> text != null && !text.isBlank())
                .toList();

        List<ChecklistItem> existingItems = entity.getItems().stream()
                .sorted(Comparator.comparing(ChecklistItem::getItemOrder)
                        .thenComparing(item -> item.getId() == null ? Long.MAX_VALUE : item.getId()))
                .toList();

        int targetCount = normalizedItems.size();
        for (int i = 0; i < targetCount; i++) {
            ChecklistItem item;
            if (i < existingItems.size()) {
                item = existingItems.get(i);
            } else {
                item = ChecklistItem.builder()
                        .checklist(entity)
                        .done(false)
                        .build();
                entity.getItems().add(item);
            }
            item.setItemOrder(i + 1);
            item.setText(normalizedItems.get(i));
            if (!item.isDone()) {
                item.setDoneBy(null);
                item.setDoneAt(null);
            }
        }

        for (int i = targetCount; i < existingItems.size(); i++) {
            entity.getItems().remove(existingItems.get(i));
        }

        entity.setCompleted(false);
    }

    private boolean applyLazyResetIfNeeded(Checklist checklist) {
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            return false;
        }
        ChecklistPeriodicity periodicity = checklist.getPeriodicity();
        if (periodicity == null || periodicity == ChecklistPeriodicity.MANUAL) {
            return false;
        }
        Instant last = checklist.getLastResetAt() != null ? checklist.getLastResetAt() : checklist.getCreatedAt();
        if (last == null) {
            last = restaurantTime.nowInstant();
        }
        Instant next = computeNextReset(last, checklist);
        boolean updated = false;
        Instant now = restaurantTime.nowInstant();
        while (next != null && !next.isAfter(now)) {
            resetChecklist(checklist, next);
            updated = true;
            next = computeNextReset(checklist.getLastResetAt(), checklist);
        }
        return updated;
    }

    private void resetChecklist(Checklist checklist, Instant moment) {
        for (ChecklistItem item : checklist.getItems()) {
            item.setDone(false);
            item.setDoneBy(null);
            item.setDoneAt(null);
            item.setReservedBy(null);
            item.setReservedAt(null);
        }
        checklist.setCompleted(false);
        checklist.setLastResetAt(moment != null ? moment : restaurantTime.nowInstant());
    }

    private int checklistGroupKey(Checklist checklist) {
        if (checklist.getKind() == ChecklistKind.TRACKABLE && !checklist.isCompleted()) {
            return 0;
        }
        if (checklist.getKind() == ChecklistKind.INFO) {
            return 1;
        }
        if (checklist.getKind() == ChecklistKind.TRACKABLE && checklist.isCompleted()) {
            return 2;
        }
        return 3;
    }

    private Instant computeNextReset(Instant base, Checklist checklist) {
        if (base == null) {
            return null;
        }
        ZoneId zone = restaurantTime.zoneFor(checklist.getRestaurant());
        return ChecklistResetCalculator.computeNextReset(base, checklist, zone);
    }

    private record ChecklistContext(Checklist checklist, RestaurantMember member, boolean canManage) {
    }
}