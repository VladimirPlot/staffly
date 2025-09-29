package ru.staffly.training.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.training.dto.TrainingCategoryDto;
import ru.staffly.training.dto.TrainingItemDto;
import ru.staffly.training.mapper.TrainingCategoryMapper;
import ru.staffly.training.mapper.TrainingItemMapper;
import ru.staffly.training.model.TrainingCategory;
import ru.staffly.training.model.TrainingItem;
import ru.staffly.training.model.TrainingModule;
import ru.staffly.training.repository.TrainingCategoryRepository;
import ru.staffly.training.repository.TrainingItemRepository;

import java.util.List;
import java.util.Optional;

@Service
@RequiredArgsConstructor
public class TrainingServiceImpl implements ru.staffly.training.service.TrainingService {

    private final TrainingCategoryRepository categories;
    private final TrainingItemRepository items;
    private final RestaurantRepository restaurants;
    private final RestaurantMemberRepository members;
    private final TrainingCategoryMapper catMapper;
    private final TrainingItemMapper itemMapper;
    private final SecurityService security;

    /* ========== CATEGORY ========== */

    @Override
    @Transactional
    public TrainingCategoryDto createCategory(Long restaurantId, Long currentUserId, TrainingCategoryDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Restaurant r = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        String name = norm(dto.name());
        if (name == null || name.isBlank()) throw new BadRequestException("Category name is required");
        if (dto.module() == null) throw new BadRequestException("Module is required");

        if (categories.existsByRestaurantIdAndModuleAndNameIgnoreCase(restaurantId, dto.module(), name)) {
            throw new ConflictException("Category already exists: " + name);
        }

        var entity = catMapper.toEntity(
                new TrainingCategoryDto(dto.id(), restaurantId, dto.module(), name, dto.description(),
                        dto.sortOrder(), dto.active(), dto.visiblePositionIds()),
                r,
                dto.visiblePositionIds()
        );
        entity = categories.save(entity);
        return catMapper.toDto(entity);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<TrainingCategoryDto> listCategories(Long restaurantId, Long currentUserId, TrainingModule module, boolean allForManagers) {
        security.assertMember(currentUserId, restaurantId);

        // базовый список активных в модуле
        var list = categories.findByRestaurantIdAndModuleAndActiveTrueOrderBySortOrderAscNameAsc(restaurantId, module)
                .stream().map(catMapper::toDto).toList();

        // кто текущий участник и его позиция
        Optional<RestaurantMember> memberOpt = members.findByUserIdAndRestaurantId(currentUserId, restaurantId);
        if (memberOpt.isEmpty()) return List.of();
        RestaurantMember member = memberOpt.get();
        Position myPos = member.getPosition();
        boolean isManagerOrAdmin = member.getRole() == RestaurantRole.ADMIN || member.getRole() == RestaurantRole.MANAGER;

        // MANAGER/ADMIN могут запросить "все" (для настройки), иначе фильтруем видимостью
        if (isManagerOrAdmin && allForManagers) {
            return list;
        }
        Long myPosId = myPos != null ? myPos.getId() : null;

        return list.stream()
                .filter(dto -> {
                    var vis = dto.visiblePositionIds();
                    // если список пустой/null — видно всем
                    if (vis == null || vis.isEmpty()) return true;
                    // если позиции нет у участника — считаем невидимой
                    if (myPosId == null) return false;
                    return vis.contains(myPosId);
                })
                .toList();
    }

    @Override
    @Transactional
    public TrainingCategoryDto updateCategory(Long restaurantId, Long currentUserId, Long categoryId, TrainingCategoryDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        TrainingCategory entity = categories.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found: " + categoryId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Category not found in this restaurant");
        }

        String newName = norm(dto.name());
        if (newName != null && !newName.equalsIgnoreCase(entity.getName())
                && categories.existsByRestaurantIdAndModuleAndNameIgnoreCase(restaurantId, entity.getModule(), newName)) {
            throw new ConflictException("Category already exists: " + newName);
        }

        catMapper.updateEntity(
                entity,
                new TrainingCategoryDto(dto.id(), restaurantId,
                        dto.module() != null ? dto.module() : entity.getModule(),
                        newName != null ? newName : entity.getName(),
                        dto.description(),
                        dto.sortOrder(),
                        dto.active(),
                        dto.visiblePositionIds()),
                entity.getRestaurant(),
                dto.visiblePositionIds()
        );
        entity = categories.save(entity);
        return catMapper.toDto(entity);
    }

    @Override
    @Transactional
    public void deleteCategory(Long restaurantId, Long currentUserId, Long categoryId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        TrainingCategory entity = categories.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found: " + categoryId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Category not found in this restaurant");
        }

        entity.setActive(false); // мягкое удаление
        categories.save(entity);
    }

    /* ========== ITEM ========== */

    @Override
    @Transactional
    public TrainingItemDto createItem(Long restaurantId, Long currentUserId, TrainingItemDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        if (dto.categoryId() == null) throw new BadRequestException("categoryId is required");

        TrainingCategory cat = categories.findById(dto.categoryId())
                .orElseThrow(() -> new NotFoundException("Category not found: " + dto.categoryId()));
        if (!cat.getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Category belongs to another restaurant");
        }
        String name = norm(dto.name());
        if (name == null || name.isBlank()) throw new BadRequestException("Item name is required");
        if (items.existsByCategoryIdAndNameIgnoreCase(cat.getId(), name)) {
            throw new ConflictException("Item already exists: " + name);
        }

        TrainingItem entity = itemMapper.toEntity(
                new ru.staffly.training.dto.TrainingItemDto(dto.id(), cat.getId(), name, dto.description(),
                        dto.composition(), dto.allergens(), dto.imageUrl(), dto.sortOrder(), dto.active()),
                cat
        );
        entity = items.save(entity);
        return itemMapper.toDto(entity);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<TrainingItemDto> listItems(Long restaurantId, Long currentUserId, Long categoryId) {
        security.assertMember(currentUserId, restaurantId);

        TrainingCategory cat = categories.findById(categoryId)
                .orElseThrow(() -> new NotFoundException("Category not found: " + categoryId));
        if (!cat.getRestaurant().getId().equals(restaurantId) || !cat.isActive()) {
            throw new NotFoundException("Category not found in this restaurant");
        }

        // Проверка видимости категории для текущего участника (если не менеджер/админ)
        RestaurantMember m = members.findByUserIdAndRestaurantId(currentUserId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Membership not found"));
        boolean isManagerOrAdmin = m.getRole() == RestaurantRole.ADMIN || m.getRole() == RestaurantRole.MANAGER;
        if (!isManagerOrAdmin) {
            if (cat.getVisibleForPositions() != null && !cat.getVisibleForPositions().isEmpty()) {
                Long myPosId = m.getPosition() != null ? m.getPosition().getId() : null;
                if (myPosId == null || cat.getVisibleForPositions().stream().map(Position::getId).noneMatch(id -> id.equals(myPosId))) {
                    throw new NotFoundException("Category not available for your position");
                }
            }
        }

        return items.findByCategoryIdAndActiveTrueOrderBySortOrderAscNameAsc(categoryId)
                .stream().map(itemMapper::toDto).toList();
    }

    @Override
    @Transactional
    public TrainingItemDto updateItem(Long restaurantId, Long currentUserId, Long itemId, TrainingItemDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        TrainingItem entity = items.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Item not found: " + itemId));
        if (!entity.getCategory().getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Item belongs to another restaurant");
        }
        // если меняем категорию
        TrainingCategory targetCat = entity.getCategory();
        if (dto.categoryId() != null && !dto.categoryId().equals(entity.getCategory().getId())) {
            targetCat = categories.findById(dto.categoryId())
                    .orElseThrow(() -> new NotFoundException("Category not found: " + dto.categoryId()));
            if (!targetCat.getRestaurant().getId().equals(restaurantId)) {
                throw new BadRequestException("Target category belongs to another restaurant");
            }
        }

        String newName = norm(dto.name());
        if (newName != null && (!newName.equalsIgnoreCase(entity.getName()) || !targetCat.getId().equals(entity.getCategory().getId()))
                && items.existsByCategoryIdAndNameIgnoreCase(targetCat.getId(), newName)) {
            throw new ConflictException("Item already exists: " + newName);
        }

        itemMapper.updateEntity(entity,
                new TrainingItemDto(dto.id(),
                        targetCat.getId(),
                        newName != null ? newName : entity.getName(),
                        dto.description(), dto.composition(), dto.allergens(), dto.imageUrl(),
                        dto.sortOrder(), dto.active()),
                targetCat);
        entity = items.save(entity);
        return itemMapper.toDto(entity);
    }

    @Override
    @Transactional
    public void deleteItem(Long restaurantId, Long currentUserId, Long itemId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        TrainingItem entity = items.findById(itemId)
                .orElseThrow(() -> new NotFoundException("Item not found: " + itemId));
        if (!entity.getCategory().getRestaurant().getId().equals(restaurantId)) {
            throw new BadRequestException("Item belongs to another restaurant");
        }
        entity.setActive(false);
        items.save(entity);
    }

    /* helpers */
    private String norm(String s) { return s == null ? null : s.trim(); }
}