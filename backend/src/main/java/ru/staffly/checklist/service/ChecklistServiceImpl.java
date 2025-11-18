package ru.staffly.checklist.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.apache.poi.xwpf.usermodel.XWPFDocument;
import org.apache.poi.xwpf.usermodel.XWPFParagraph;
import org.apache.poi.xwpf.usermodel.XWPFRun;
import org.springframework.stereotype.Service;
import ru.staffly.checklist.dto.ChecklistDto;
import ru.staffly.checklist.dto.ChecklistRequest;
import ru.staffly.checklist.mapper.ChecklistMapper;
import ru.staffly.checklist.model.Checklist;
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

import java.io.ByteArrayOutputStream;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.util.HashSet;
import java.util.List;
import java.util.Locale;
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

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ChecklistDto> list(Long restaurantId, Long currentUserId, List<String> globalRoles, Long positionFilterId) {
        security.assertMember(currentUserId, restaurantId);

        RestaurantMember member = members.findByUserIdAndRestaurantId(currentUserId, restaurantId).orElse(null);
        boolean isCreator = hasRole(globalRoles, "CREATOR");
        boolean canManage = isCreator || (member != null && isManagerOrAdmin(member));
        Long myPositionId = member != null && member.getPosition() != null ? member.getPosition().getId() : null;

        Long effectiveFilter = null;
        if (canManage) {
            effectiveFilter = positionFilterId;
        } else {
            effectiveFilter = myPositionId;
            if (effectiveFilter == null) {
                return List.of();
            }
        }

        Long finalEffectiveFilter = effectiveFilter;
        return checklists.findByRestaurantIdOrderByNameAsc(restaurantId).stream()
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
                .map(mapper::toDto)
                .toList();
    }

    @Override
    @Transactional
    public ChecklistDto create(Long restaurantId, Long currentUserId, ChecklistRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Restaurant restaurant = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        String name = normalize(request.name());
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }
        String content = normalizeContent(request.content());
        if (content == null || content.trim().isEmpty()) {
            throw new BadRequestException("Содержимое обязательно");
        }
        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());

        Checklist entity = Checklist.builder()
                .restaurant(restaurant)
                .name(name)
                .content(content)
                .build();
        mapper.applyPositions(entity, new HashSet<>(targetPositions));
        entity = checklists.save(entity);
        return mapper.toDto(entity);
    }

    @Override
    @Transactional
    public ChecklistDto update(Long restaurantId, Long currentUserId, Long checklistId, ChecklistRequest request) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        Checklist entity = checklists.findWithPositionsById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }

        String name = normalize(request.name());
        if (name == null || name.isBlank()) {
            throw new BadRequestException("Название обязательно");
        }
        String content = normalizeContent(request.content());
        if (content == null || content.trim().isEmpty()) {
            throw new BadRequestException("Содержимое обязательно");
        }
        entity.setName(name);
        entity.setContent(content);
        List<Position> targetPositions = resolvePositions(restaurantId, request.positionIds());
        mapper.applyPositions(entity, new HashSet<>(targetPositions));
        entity = checklists.save(entity);
        return mapper.toDto(entity);
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

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public byte[] download(Long restaurantId, Long currentUserId, Long checklistId, String format) {
        security.assertMember(currentUserId, restaurantId);
        Checklist entity = checklists.findWithPositionsById(checklistId)
                .orElseThrow(() -> new NotFoundException("Checklist not found: " + checklistId));
        if (!entity.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Checklist not found in this restaurant");
        }
        String normalizedFormat = (format == null ? "txt" : format.trim().toLowerCase(Locale.ROOT));
        return switch (normalizedFormat) {
            case "txt" -> entity.getContent().getBytes(StandardCharsets.UTF_8);
            case "docx" -> toDocx(entity.getContent());
            default -> throw new BadRequestException("Неизвестный формат: " + format);
        };
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

    private byte[] toDocx(String content) {
        try (XWPFDocument doc = new XWPFDocument(); ByteArrayOutputStream out = new ByteArrayOutputStream()) {
            XWPFParagraph paragraph = doc.createParagraph();
            XWPFRun run = paragraph.createRun();
            String[] lines = content.split("\\n", -1);
            for (int i = 0; i < lines.length; i++) {
                if (i > 0) {
                    run.addBreak();
                }
                run.setText(lines[i], i);
            }
            doc.write(out);
            return out.toByteArray();
        } catch (IOException e) {
            throw new IllegalStateException("Не удалось сформировать файл", e);
        }
    }
}