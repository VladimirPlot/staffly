package ru.staffly.checklist.service;

import jakarta.transaction.Transactional;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
import lombok.RequiredArgsConstructor;
import org.springframework.transaction.support.TransactionSynchronization;
import org.springframework.transaction.support.TransactionSynchronizationManager;
import org.springframework.stereotype.Service;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistHistoryDetailDto;
import ru.staffly.checklist.dto.ChecklistHistorySummaryDto;
import ru.staffly.checklist.dto.ChecklistItemRequest;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.mapper.ChecklistHistoryMapper;
import ru.staffly.checklist.mapper.ChecklistMapper;
import ru.staffly.checklist.model.Checklist;
import ru.staffly.checklist.model.ChecklistItem;
import ru.staffly.checklist.model.ChecklistKind;
import ru.staffly.checklist.model.ChecklistPeriodicity;
import ru.staffly.checklist.model.ChecklistResetReason;
import ru.staffly.checklist.repository.ChecklistHistoryRepository;
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
import ru.staffly.media.ChecklistImageStorage;
import org.springframework.web.multipart.MultipartFile;

import java.io.IOException;
import java.text.Collator;
import java.time.Instant;
import java.time.LocalTime;
import java.time.ZoneId;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
public class ChecklistServiceImpl implements ChecklistService {

    private static final long MAX_IMAGE_BYTES = 2L * 1024 * 1024;

    private final EntityManager entityManager;
    private final ChecklistRepository checklists;
    private final ChecklistHistoryRepository histories;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final RestaurantMemberRepository members;
    private final ChecklistMapper mapper;
    private final ChecklistHistoryMapper historyMapper;
    private final ChecklistHistoryService historyService;
    private final SecurityService security;
    private final RestaurantTimeService restaurantTime;
    private final ChecklistImageStorage imageStorage;

    @Override
    @Transactional
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
        List<NormalizedChecklistItem> items = normalizeItemRequests(request);

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
        Checklist entity = checklists.findDetailedByIdForUpdate(checklistId)
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
        List<NormalizedChecklistItem> items = normalizeItemRequests(request);

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
            scheduleItemPhotoCleanup(entity.getItems());
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
            if (item.isCompletionPhotoRequired() && isBlank(item.getCompletionPhotoUrl())) {
                throw new BadRequestException("Прикрепите фото выполнения");
            }
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
        String previousCompletionPhotoUrl = item.getCompletionPhotoUrl();
        item.setDone(false);
        item.setDoneAt(null);
        item.setDoneBy(null);
        item.setReservedBy(null);
        item.setReservedAt(null);
        item.setCompletionPhotoUrl(null);
        item.setCompletionPhotoUploadedBy(null);
        item.setCompletionPhotoUploadedAt(null);
        deleteCompletionPhotoAfterCommit(previousCompletionPhotoUrl);
        context.checklist().setCompleted(context.checklist().getItems().stream().allMatch(ChecklistItem::isDone));
        return mapper.toDto(checklists.save(context.checklist()));
    }

    @Override
    @Transactional
    public ChecklistDto reset(Long restaurantId, Long currentUserId, Long checklistId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist checklist = checklists.findDetailedByIdForUpdate(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!Objects.equals(checklist.getRestaurant().getId(), restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            throw new BadRequestException("Можно сбросить только проверяемый чек-лист");
        }
        resetChecklist(checklist, restaurantTime.nowInstant(), ChecklistResetReason.MANUAL);
        checklist = checklists.save(checklist);
        return mapper.toDto(checklist);
    }

    @Override
    @Transactional
    public void delete(Long restaurantId, Long currentUserId, Long checklistId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist entity = checklists.findDetailedByIdForUpdate(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        List<String> examplePhotoUrls = entity.getItems().stream()
                .map(ChecklistItem::getExamplePhotoUrl)
                .filter(url -> !isBlank(url))
                .toList();
        List<String> completionPhotoUrls = entity.getItems().stream()
                .map(ChecklistItem::getCompletionPhotoUrl)
                .filter(url -> !isBlank(url))
                .toList();
        checklists.delete(entity);
        afterCommit(() -> {
            examplePhotoUrls.forEach(this::deleteExamplePhotoIfNotArchived);
            completionPhotoUrls.forEach(this::deleteCompletionPhotoIfNotArchived);
        });
    }

    @Override
    @Transactional
    public ChecklistDto uploadExamplePhoto(Long restaurantId,
                                           Long currentUserId,
                                           Long checklistId,
                                           Long itemId,
                                           MultipartFile file) throws IOException {
        security.assertAtLeastManager(currentUserId, restaurantId);
        validateImageFile(file);
        Checklist checklist = loadManageableTrackableChecklist(restaurantId, checklistId);
        ChecklistItem item = findChecklistItem(checklist, itemId);

        String previousPhotoUrl = item.getExamplePhotoUrl();
        String uploadedPhotoUrl = imageStorage.saveExampleForItem(itemId, file);
        item.setExamplePhotoUrl(uploadedPhotoUrl);

        afterCommit(() -> deleteExamplePhotoIfNotArchived(previousPhotoUrl));
        afterRollback(() -> imageStorage.deleteByPublicUrl(uploadedPhotoUrl));
        return mapper.toDto(checklists.save(checklist));
    }

    @Override
    @Transactional
    public ChecklistDto deleteExamplePhoto(Long restaurantId,
                                           Long currentUserId,
                                           Long checklistId,
                                           Long itemId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist checklist = loadManageableTrackableChecklist(restaurantId, checklistId);
        ChecklistItem item = findChecklistItem(checklist, itemId);
        String previousPhotoUrl = item.getExamplePhotoUrl();
        item.setExamplePhotoUrl(null);
        afterCommit(() -> deleteExamplePhotoIfNotArchived(previousPhotoUrl));
        return mapper.toDto(checklists.save(checklist));
    }

    @Override
    @Transactional
    public ChecklistDto uploadCompletionPhoto(Long restaurantId,
                                              Long currentUserId,
                                              Long checklistId,
                                              Long itemId,
                                              MultipartFile file) throws IOException {
        validateImageFile(file);
        ChecklistContext context = loadChecklistContext(restaurantId, currentUserId, checklistId);
        ChecklistItem item = findChecklistItem(context.checklist(), itemId);
        assertCanChangeCompletionPhoto(item, context);

        String previousPhotoUrl = item.getCompletionPhotoUrl();
        String uploadedPhotoUrl = imageStorage.saveCompletionForItem(itemId, file);
        item.setCompletionPhotoUrl(uploadedPhotoUrl);
        item.setCompletionPhotoUploadedBy(context.member());
        item.setCompletionPhotoUploadedAt(restaurantTime.nowInstant());

        afterCommit(() -> deleteCompletionPhotoIfNotArchived(previousPhotoUrl));
        afterRollback(() -> imageStorage.deleteCompletionReference(uploadedPhotoUrl));
        return mapper.toDto(checklists.save(context.checklist()));
    }

    @Override
    @Transactional
    public ChecklistDto deleteCompletionPhoto(Long restaurantId,
                                              Long currentUserId,
                                              Long checklistId,
                                              Long itemId) {
        ChecklistContext context = loadChecklistContext(restaurantId, currentUserId, checklistId);
        ChecklistItem item = findChecklistItem(context.checklist(), itemId);
        assertCanChangeCompletionPhoto(item, context);
        if (item.getCompletionPhotoUploadedBy() != null
                && !item.getCompletionPhotoUploadedBy().getId().equals(context.member().getId())
                && !context.canManage()) {
            throw new ConflictException("Фото выполнения прикрепил другой сотрудник");
        }

        String previousPhotoUrl = item.getCompletionPhotoUrl();
        item.setCompletionPhotoUrl(null);
        item.setCompletionPhotoUploadedBy(null);
        item.setCompletionPhotoUploadedAt(null);
        afterCommit(() -> deleteCompletionPhotoIfNotArchived(previousPhotoUrl));
        return mapper.toDto(checklists.save(context.checklist()));
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ChecklistHistorySummaryDto> listHistory(Long restaurantId, Long currentUserId, Long checklistId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist checklist = checklists.findWithPositionsById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!Objects.equals(checklist.getRestaurant().getId(), restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        return histories.findTop50ByChecklistIdAndRestaurantIdOrderByResetAtDesc(checklistId, restaurantId).stream()
                .map(historyMapper::toSummaryDto)
                .toList();
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public ChecklistHistoryDetailDto getHistory(Long restaurantId, Long currentUserId, Long historyId) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        return histories.findByIdAndRestaurantId(historyId, restaurantId)
                .map(historyMapper::toDetailDto)
                .orElseThrow(() -> new NotFoundException("Checklist history not found: " + historyId));
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
        Checklist checklist = checklists.findDetailedByIdForUpdate(checklistId)
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
        if (applyDueAutoReset(checklist)) {
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
                                   List<NormalizedChecklistItem> items) {
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
        if (items == null || items.isEmpty()) {
            throw new BadRequestException("Добавьте хотя бы один пункт");
        }
    }

    private List<NormalizedChecklistItem> normalizeItemRequests(ChecklistRequest request) {
        if (request.itemDetails() != null && !request.itemDetails().isEmpty()) {
            return request.itemDetails().stream()
                    .map(this::normalizeItemRequest)
                    .filter(Objects::nonNull)
                    .toList();
        }
        if (request.items() == null || request.items().isEmpty()) {
            return List.of();
        }
        return request.items().stream()
                .map(this::normalize)
                .filter(text -> text != null && !text.isBlank())
                .map(text -> new NormalizedChecklistItem(null, text, false))
                .toList();
    }

    private NormalizedChecklistItem normalizeItemRequest(ChecklistItemRequest request) {
        if (request == null) {
            return null;
        }
        String text = normalize(request.text());
        if (text == null || text.isBlank()) {
            return null;
        }
        return new NormalizedChecklistItem(request.id(), text, Boolean.TRUE.equals(request.completionPhotoRequired()));
    }

    private void applyItems(Checklist entity, List<NormalizedChecklistItem> requestedItems) {
        List<NormalizedChecklistItem> safeRequests = requestedItems == null ? List.of() : requestedItems;
        Map<Long, ChecklistItem> existingById = entity.getItems().stream()
                .filter(item -> item.getId() != null)
                .collect(Collectors.toMap(ChecklistItem::getId, item -> item, (left, right) -> left, LinkedHashMap::new));
        List<ChecklistItem> existingOrdered = entity.getItems().stream()
                .sorted(Comparator.comparing(ChecklistItem::getItemOrder)
                        .thenComparing(item -> item.getId() == null ? Long.MAX_VALUE : item.getId()))
                .toList();

        Set<Long> usedIds = new HashSet<>();
        int legacyIndex = 0;
        List<ChecklistItem> nextItems = new ArrayList<>();
        for (int index = 0; index < safeRequests.size(); index++) {
            NormalizedChecklistItem request = safeRequests.get(index);
            ChecklistItem item = null;
            if (request.id() != null) {
                if (!usedIds.add(request.id())) {
                    throw new BadRequestException("Пункт чек-листа указан несколько раз: " + request.id());
                }
                item = existingById.get(request.id());
                if (item == null) {
                    throw new BadRequestException("Пункт чек-листа не найден: " + request.id());
                }
            } else {
                while (legacyIndex < existingOrdered.size()) {
                    ChecklistItem candidate = existingOrdered.get(legacyIndex++);
                    Long candidateId = candidate.getId();
                    if (candidateId == null || !usedIds.contains(candidateId)) {
                        item = candidate;
                        if (candidateId != null) {
                            usedIds.add(candidateId);
                        }
                        break;
                    }
                }
                if (item == null) {
                    item = ChecklistItem.builder()
                            .checklist(entity)
                            .done(false)
                            .completionPhotoRequired(false)
                            .build();
                    entity.getItems().add(item);
                }
            }

            item.setText(request.text());
            item.setCompletionPhotoRequired(request.completionPhotoRequired());
            nextItems.add(item);
        }

        List<ChecklistItem> removedItems = entity.getItems().stream()
                .filter(item -> !nextItems.contains(item))
                .toList();
        moveExistingItemsToTemporaryOrders(entity);
        for (ChecklistItem removedItem : removedItems) {
            String examplePhotoUrl = removedItem.getExamplePhotoUrl();
            String completionPhotoUrl = removedItem.getCompletionPhotoUrl();
            removedItem.setExamplePhotoUrl(null);
            removedItem.setCompletionPhotoUrl(null);
            removedItem.setCompletionPhotoUploadedBy(null);
            removedItem.setCompletionPhotoUploadedAt(null);
            entity.getItems().remove(removedItem);
            afterCommit(() -> {
                deleteExamplePhotoIfNotArchived(examplePhotoUrl);
                deleteCompletionPhotoIfNotArchived(completionPhotoUrl);
            });
        }
        for (int index = 0; index < nextItems.size(); index++) {
            nextItems.get(index).setItemOrder(index + 1);
        }

        entity.setCompleted(!nextItems.isEmpty() && nextItems.stream().allMatch(ChecklistItem::isDone));
    }

    private void moveExistingItemsToTemporaryOrders(Checklist entity) {
        if (entity.getId() == null || entity.getItems().stream().noneMatch(item -> item.getId() != null)) {
            return;
        }
        List<ChecklistItem> items = entity.getItems().stream()
                .sorted(Comparator.comparing(ChecklistItem::getItemOrder, Comparator.nullsLast(Integer::compareTo))
                        .thenComparing(item -> item.getId() == null ? Long.MAX_VALUE : item.getId()))
                .toList();
        for (int index = 0; index < items.size(); index++) {
            items.get(index).setItemOrder(-(index + 1));
        }
        entityManager.flush();
    }

    private boolean applyLazyResetIfNeeded(Checklist checklist) {
        if (checklist == null || checklist.getId() == null || !hasDueAutoReset(checklist)) {
            return false;
        }

        Checklist lockedChecklist = checklists.findDetailedByIdForUpdate(checklist.getId()).orElse(null);
        if (lockedChecklist == null) {
            return false;
        }

        entityManager.refresh(lockedChecklist, LockModeType.PESSIMISTIC_WRITE);
        return applyDueAutoReset(lockedChecklist);
    }

    private boolean applyDueAutoReset(Checklist lockedChecklist) {
        if (!hasDueAutoReset(lockedChecklist)) {
            return false;
        }
        Instant resetMoment = computeLatestDueReset(lockedChecklist);
        if (resetMoment == null) {
            return false;
        }
        resetChecklist(lockedChecklist, resetMoment, ChecklistResetReason.AUTO);
        return true;
    }

    private boolean hasDueAutoReset(Checklist checklist) {
        if (checklist == null || checklist.getKind() != ChecklistKind.TRACKABLE) {
            return false;
        }
        ChecklistPeriodicity periodicity = checklist.getPeriodicity();
        if (periodicity == null || periodicity == ChecklistPeriodicity.MANUAL) {
            return false;
        }
        return computeLatestDueReset(checklist) != null;
    }

    private Instant computeLatestDueReset(Checklist checklist) {
        Instant last = checklist.getLastResetAt() != null ? checklist.getLastResetAt() : checklist.getCreatedAt();
        if (last == null) {
            last = restaurantTime.nowInstant();
        }
        ZoneId zone = restaurantTime.zoneFor(checklist.getRestaurant());
        return ChecklistResetCalculator.computeLatestDueReset(last, checklist, zone, restaurantTime.nowInstant());
    }

    private void resetChecklist(Checklist checklist, Instant moment, ChecklistResetReason reason) {
        Instant resetMoment = moment != null ? moment : restaurantTime.nowInstant();
        historyService.snapshotBeforeReset(checklist, resetMoment, reason);
        for (ChecklistItem item : checklist.getItems()) {
            item.setDone(false);
            item.setDoneBy(null);
            item.setDoneAt(null);
            item.setReservedBy(null);
            item.setReservedAt(null);
            item.setCompletionPhotoUrl(null);
            item.setCompletionPhotoUploadedBy(null);
            item.setCompletionPhotoUploadedAt(null);
        }
        checklist.setCompleted(false);
        checklist.setLastResetAt(resetMoment);
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

    private Checklist loadManageableTrackableChecklist(Long restaurantId, Long checklistId) {
        Checklist checklist = checklists.findDetailedByIdForUpdate(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!Objects.equals(checklist.getRestaurant().getId(), restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        if (checklist.getKind() != ChecklistKind.TRACKABLE) {
            throw new BadRequestException("Можно работать только с проверяемыми чек-листами");
        }
        if (applyDueAutoReset(checklist)) {
            checklists.save(checklist);
        }
        return checklist;
    }

    private void assertCanChangeCompletionPhoto(ChecklistItem item, ChecklistContext context) {
        if (item.isDone()) {
            throw new BadRequestException("Нельзя менять фото выполненного пункта");
        }
        if (item.getReservedBy() != null && !item.getReservedBy().getId().equals(context.member().getId())) {
            throw new ConflictException("Пункт забронирован другим сотрудником");
        }
    }

    private void validateImageFile(MultipartFile file) throws IOException {
        if (file == null || file.isEmpty()) {
            throw new BadRequestException("Файл не выбран");
        }
        if (file.getSize() > MAX_IMAGE_BYTES) {
            throw new BadRequestException("Файл больше 2MB");
        }

        String contentType = file.getContentType() == null ? "" : file.getContentType().toLowerCase(Locale.ROOT);
        int separator = contentType.indexOf(';');
        if (separator > -1) {
            contentType = contentType.substring(0, separator).trim();
        }
        if (!Set.of("image/jpeg", "image/png", "image/webp").contains(contentType)) {
            throw new BadRequestException("Разрешены только JPEG/PNG/WEBP");
        }

        byte[] bytes = file.getBytes();
        if (bytes.length < 12) {
            throw new BadRequestException("Некорректный файл изображения");
        }

        boolean jpeg = (bytes[0] & 0xFF) == 0xFF && (bytes[1] & 0xFF) == 0xD8;
        boolean png = (bytes[0] & 0xFF) == 0x89 && bytes[1] == 0x50 && bytes[2] == 0x4E && bytes[3] == 0x47;
        boolean webp = bytes[0] == 'R' && bytes[1] == 'I' && bytes[2] == 'F' && bytes[3] == 'F'
                && bytes[8] == 'W' && bytes[9] == 'E' && bytes[10] == 'B' && bytes[11] == 'P';
        if (!jpeg && !png && !webp) {
            throw new BadRequestException("Некорректная сигнатура изображения");
        }
    }

    private void scheduleItemPhotoCleanup(Set<ChecklistItem> items) {
        if (items == null || items.isEmpty()) {
            return;
        }
        List<String> examplePhotoUrls = items.stream()
                .map(ChecklistItem::getExamplePhotoUrl)
                .filter(url -> !isBlank(url))
                .toList();
        List<String> completionPhotoUrls = items.stream()
                .map(ChecklistItem::getCompletionPhotoUrl)
                .filter(url -> !isBlank(url))
                .toList();
        afterCommit(() -> {
            examplePhotoUrls.forEach(this::deleteExamplePhotoIfNotArchived);
            completionPhotoUrls.forEach(this::deleteCompletionPhotoIfNotArchived);
        });
    }

    private void deleteCompletionPhotoAfterCommit(String publicUrl) {
        afterCommit(() -> deleteCompletionPhotoIfNotArchived(publicUrl));
    }

    private void deleteExamplePhotoIfNotArchived(String publicUrl) {
        if (isBlank(publicUrl) || historyService.isExamplePhotoReferenced(publicUrl)) {
            return;
        }
        imageStorage.deleteByPublicUrl(publicUrl);
    }

    private void deleteCompletionPhotoIfNotArchived(String publicUrl) {
        if (isBlank(publicUrl) || historyService.isCompletionPhotoReferenced(publicUrl)) {
            return;
        }
        imageStorage.deleteCompletionReference(publicUrl);
    }

    private boolean isBlank(String value) {
        return value == null || value.isBlank();
    }

    private void afterCommit(Runnable action) {
        registerTransactionCallback(action, null);
    }

    private void afterRollback(Runnable action) {
        registerTransactionCallback(null, action);
    }

    private void registerTransactionCallback(Runnable afterCommitAction, Runnable afterRollbackAction) {
        if (!TransactionSynchronizationManager.isSynchronizationActive()) {
            if (afterCommitAction != null) {
                afterCommitAction.run();
            }
            return;
        }

        TransactionSynchronizationManager.registerSynchronization(new TransactionSynchronization() {
            @Override
            public void afterCommit() {
                if (afterCommitAction != null) {
                    afterCommitAction.run();
                }
            }

            @Override
            public void afterCompletion(int status) {
                if (status != STATUS_COMMITTED && afterRollbackAction != null) {
                    afterRollbackAction.run();
                }
            }
        });
    }

    private record NormalizedChecklistItem(Long id, String text, boolean completionPhotoRequired) {
    }

    private record ChecklistContext(Checklist checklist, RestaurantMember member, boolean canManage) {
    }
}
