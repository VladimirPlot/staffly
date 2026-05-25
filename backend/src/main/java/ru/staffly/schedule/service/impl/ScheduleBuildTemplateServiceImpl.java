package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleBuildTemplateService;
import ru.staffly.security.SecurityService;

import java.time.LocalTime;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleBuildTemplateServiceImpl implements ScheduleBuildTemplateService {
    private final ScheduleBuildTemplateRepository templates;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;

    @Override @Transactional(readOnly = true)
    public List<ScheduleBuildTemplateDto> list(Long restaurantId, Long actorUserId) {
        assertManageAccess(restaurantId, actorUserId);
        return templates.findByRestaurantIdAndIsActiveTrueOrderByNameAsc(restaurantId).stream()
                .peek(this::initializeTemplateCollections)
                .map(this::toDto)
                .toList();
    }
    @Override @Transactional(readOnly = true)
    public ScheduleBuildTemplateDto get(Long restaurantId, Long templateId, Long actorUserId) {
        assertManageAccess(restaurantId, actorUserId);
        return toDto(getTemplate(restaurantId, templateId));
    }
    @Override
    public ScheduleBuildTemplateDto create(Long restaurantId, Long actorUserId, SaveScheduleBuildTemplateRequest request) {
        assertManageAccess(restaurantId, actorUserId);
        Restaurant restaurant = restaurants.findById(restaurantId).orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));
        ScheduleBuildTemplate template = new ScheduleBuildTemplate();
        template.setRestaurant(restaurant);
        applyRequest(template, restaurantId, request, true);
        return toDto(templates.save(template));
    }
    @Override
    public ScheduleBuildTemplateDto update(Long restaurantId, Long templateId, Long actorUserId, SaveScheduleBuildTemplateRequest request) {
        assertManageAccess(restaurantId, actorUserId);
        ScheduleBuildTemplate template = getTemplate(restaurantId, templateId);
        applyRequest(template, restaurantId, request, false);
        return toDto(templates.save(template));
    }
    @Override
    public void archive(Long restaurantId, Long templateId, Long actorUserId) {
        assertManageAccess(restaurantId, actorUserId);
        ScheduleBuildTemplate template = getTemplate(restaurantId, templateId);
        template.setActive(false);
        templates.save(template);
    }

    private void applyRequest(ScheduleBuildTemplate template, Long restaurantId, SaveScheduleBuildTemplateRequest request, boolean creating) {
        String name = Optional.ofNullable(request.name()).map(String::trim).orElse("");
        if (name.isEmpty()) throw new BadRequestException("name is required");
        if (creating || !equalsIgnoreCase(name, template.getName())) {
            if (templates.existsByRestaurantIdAndNameIgnoreCase(restaurantId, name)) throw new BadRequestException("Template with this name already exists");
        }
        List<SaveScheduleBuildPositionConfigRequest> configRequests = Optional.ofNullable(request.positionConfigs()).orElse(List.of());
        if (configRequests.isEmpty()) throw new BadRequestException("At least one positionConfig is required");

        Set<Long> positionIds = new HashSet<>();
        for (SaveScheduleBuildPositionConfigRequest cfg : configRequests) {
            if (cfg.positionId() == null || !positionIds.add(cfg.positionId())) throw new BadRequestException("Duplicate or null positionId in positionConfigs");
        }
        Map<Long, Position> positionMap = positions.findAllById(positionIds).stream()
                .filter(p -> p.getRestaurant() != null && restaurantId.equals(p.getRestaurant().getId()))
                .collect(Collectors.toMap(Position::getId, Function.identity()));
        if (positionMap.size() != positionIds.size()) throw new BadRequestException("All positionIds must belong to restaurant");

        template.setName(name);
        template.setDescription(trimToNull(request.description()));
        template.setActive(request.isActive() == null || request.isActive());
        template.getPositionConfigs().clear();

        int idx = 0;
        for (SaveScheduleBuildPositionConfigRequest cfg : configRequests) {
            validateInterval(cfg.fullShiftStart(), cfg.fullShiftEnd(), "fullShift");
            List<SaveScheduleBuildShiftOptionRequest> shiftOptions = Optional.ofNullable(cfg.shiftOptions()).orElse(List.of());
            if (shiftOptions.isEmpty()) throw new BadRequestException("shiftOptions must not be empty");

            ScheduleBuildPositionConfig entity = new ScheduleBuildPositionConfig();
            entity.setTemplate(template);
            entity.setPosition(positionMap.get(cfg.positionId()));
            entity.setFullShiftStart(cfg.fullShiftStart());
            entity.setFullShiftEnd(cfg.fullShiftEnd());
            entity.setTargetPattern(cfg.targetPattern() == null ? ScheduleBuildPattern.NONE : cfg.targetPattern());
            if (cfg.minRestHours() != null && cfg.minRestHours() < 0) throw new BadRequestException("minRestHours must be >= 0");
            if (cfg.maxShiftsPerPeriod() != null && cfg.maxShiftsPerPeriod() <= 0) throw new BadRequestException("maxShiftsPerPeriod must be > 0");
            entity.setMinRestHours(cfg.minRestHours());
            entity.setMaxShiftsPerPeriod(cfg.maxShiftsPerPeriod());
            entity.setSortOrder(cfg.sortOrder() != null ? cfg.sortOrder() : idx);

            int so = 0;
            for (SaveScheduleBuildShiftOptionRequest option : shiftOptions) {
                validateInterval(option.startTime(), option.endTime(), "shiftOption");
                ScheduleBuildShiftOption o = new ScheduleBuildShiftOption();
                o.setPositionConfig(entity);
                o.setStartTime(option.startTime());
                o.setEndTime(option.endTime());
                o.setLabel(trimToNull(option.label()));
                o.setFullShift(Boolean.TRUE.equals(option.isFullShift()));
                o.setSortOrder(option.sortOrder() != null ? option.sortOrder() : so++);
                entity.getShiftOptions().add(o);
            }

            int cro = 0;
            for (SaveScheduleBuildCoverageRuleRequest rule : Optional.ofNullable(cfg.coverageRules()).orElse(List.of())) {
                if (rule.dayOfWeek() == null || rule.dayOfWeek() < 1 || rule.dayOfWeek() > 7) throw new BadRequestException("coverageRule.dayOfWeek must be 1..7");
                if (rule.requiredCount() == null || rule.requiredCount() <= 0) throw new BadRequestException("coverageRule.requiredCount must be > 0");
                validateInterval(rule.startTime(), rule.endTime(), "coverageRule");
                ScheduleBuildCoverageRule r = new ScheduleBuildCoverageRule();
                r.setPositionConfig(entity);
                r.setDayOfWeek(rule.dayOfWeek());
                r.setStartTime(rule.startTime());
                r.setEndTime(rule.endTime());
                r.setRequiredCount(rule.requiredCount());
                r.setSortOrder(rule.sortOrder() != null ? rule.sortOrder() : cro++);
                entity.getCoverageRules().add(r);
            }

            template.getPositionConfigs().add(entity);
            idx++;
        }
    }

    private void validateInterval(LocalTime start, LocalTime end, String field) {
        if (start == null || end == null) throw new BadRequestException(field + " interval is required");
        if (start.equals(end)) throw new BadRequestException(field + " startTime must not equal endTime");
        if (!end.equals(LocalTime.MIDNIGHT) && start.isAfter(end)) throw new BadRequestException(field + " startTime must be before endTime");
    }

    private void assertManageAccess(Long restaurantId, Long actorUserId) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);
    }
    private ScheduleBuildTemplate getTemplate(Long restaurantId, Long templateId) {
        ScheduleBuildTemplate template = templates.findByIdAndRestaurantId(templateId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule build template not found: " + templateId));
        initializeTemplateCollections(template);
        return template;
    }

    private void initializeTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig positionConfig : template.getPositionConfigs()) {
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
        }
    }

    private ScheduleBuildTemplateDto toDto(ScheduleBuildTemplate t) {
        return new ScheduleBuildTemplateDto(t.getId(), t.getName(), t.getDescription(), t.isActive(), t.getCreatedAt(), t.getUpdatedAt(),
                t.getPositionConfigs().stream().map(pc -> new ScheduleBuildPositionConfigDto(
                        pc.getId(), pc.getPosition().getId(), pc.getPosition().getName(), pc.getFullShiftStart(), pc.getFullShiftEnd(),
                        pc.getTargetPattern(), pc.getMinRestHours(), pc.getMaxShiftsPerPeriod(),
                        pc.getShiftOptions().stream().map(o -> new ScheduleBuildShiftOptionDto(o.getId(), o.getStartTime(), o.getEndTime(), o.getLabel(), o.isFullShift(), o.getSortOrder())).toList(),
                        pc.getCoverageRules().stream().map(r -> new ScheduleBuildCoverageRuleDto(r.getId(), r.getDayOfWeek(), r.getStartTime(), r.getEndTime(), r.getRequiredCount(), r.getSortOrder())).toList(),
                        pc.getSortOrder())).toList());
    }

    private boolean equalsIgnoreCase(String left, String right) {
        return left != null && right != null && left.equalsIgnoreCase(right);
    }

    private String trimToNull(String value) {
        if (value == null) return null;
        String trimmed = value.trim();
        return trimmed.isEmpty() ? null : trimmed;
    }
}
