package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import jakarta.persistence.EntityManager;
import jakarta.persistence.LockModeType;
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
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.exception.ScheduleDomainConflictException;
import ru.staffly.schedule.exception.ScheduleBuildTemplateConfirmationRequiredException;
import ru.staffly.schedule.exception.ScheduleBuildTemplateVersionConflictException;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleBuildTemplateImpactPlan;
import ru.staffly.schedule.service.ScheduleBuildTemplateImpactPlanner;
import ru.staffly.schedule.service.ScheduleBuildTemplateScheduleAction;
import ru.staffly.schedule.service.ScheduleBuildTemplateService;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
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
    private final ScheduleRepository schedules;
    private final RestaurantRepository restaurants;
    private final PositionRepository positions;
    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleBuildTemplateImpactPlanner impactPlanner;
    private final SchedulePreferenceLifecycleService preferenceLifecycle;
    private final EntityManager entityManager;

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
        applyPreparedRequest(template, prepareRequest(template, restaurantId, request, true));
        return toDto(templates.save(template));
    }
    @Override
    public ScheduleBuildTemplateDto update(Long restaurantId, Long templateId, Long actorUserId, SaveScheduleBuildTemplateRequest request) {
        assertManageAccess(restaurantId, actorUserId);
        if (request == null) {
            throw new BadRequestException("request body is required");
        }
        ScheduleBuildTemplate template = getEditableTemplate(restaurantId, templateId);
        assertExpectedVersion(template, request.expectedVersion());
        PreparedTemplateRequest prepared = prepareRequest(template, restaurantId, request, false);

        List<Long> linkedIds = schedules.findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(
                restaurantId, templateId);
        List<Schedule> lockedSchedules = linkedIds.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, linkedIds);
        List<Long> authoritativeLinkedIds = schedules
                .findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(restaurantId, templateId);
        if (lockedSchedules.size() != linkedIds.size() || !linkedIds.equals(authoritativeLinkedIds)) {
            throw new ScheduleDomainConflictException("SCHEDULE_BUILD_TEMPLATE_LINKAGE_CHANGED",
                    "Состав связанных графиков изменился. Повторите действие.");
        }

        ScheduleBuildTemplateImpactPlan plan = impactPlanner.plan(template, request, lockedSchedules);
        boolean parentScalarChange = hasParentScalarChange(template, prepared);
        if (plan.impact() == ru.staffly.schedule.service.ScheduleBuildTemplateChangeImpact.NONE
                && !parentScalarChange) {
            return toDto(template);
        }
        if (plan.hasDestructiveConsequences() && !request.consequencesConfirmed()) {
            throw new ScheduleBuildTemplateConfirmationRequiredException(plan);
        }
        executeConsequences(plan, lockedSchedules, actorUserId);
        applyPreparedRequest(template, prepared);
        if (!parentScalarChange) {
            // Inverse child changes do not dirty the aggregate root. Force exactly its one
            // optimistic revision increment; scalar-dirty updates use Hibernate's normal bump.
            entityManager.lock(template, LockModeType.PESSIMISTIC_FORCE_INCREMENT);
        }
        return toDto(templates.saveAndFlush(template));
    }
    @Override
    public void archive(Long restaurantId, Long templateId, Long actorUserId) {
        assertManageAccess(restaurantId, actorUserId);
        ScheduleBuildTemplate template = getEditableTemplate(restaurantId, templateId);
        if (schedules.existsByPreferenceBuildTemplateIdAndStatus(
                templateId, ScheduleStatus.COLLECTING_PREFERENCES)) {
            throw new ScheduleDomainConflictException(
                    "SCHEDULE_BUILD_TEMPLATE_LOCKED_BY_PREFERENCE_COLLECTION",
                    "Шаблон нельзя архивировать, пока по связанному графику идёт сбор пожеланий."
            );
        }
        template.setActive(false);
        templates.save(template);
    }

    private PreparedTemplateRequest prepareRequest(ScheduleBuildTemplate template, Long restaurantId,
                                                    SaveScheduleBuildTemplateRequest request, boolean creating) {
        if (request == null) {
            throw new BadRequestException("request body is required");
        }
        String name = Optional.ofNullable(request.name()).map(String::trim).orElse("");
        if (name.isEmpty()) throw new BadRequestException("name is required");
        if (creating || !equalsIgnoreCase(name, template.getName())) {
            if (templates.existsByRestaurantIdAndNameIgnoreCase(restaurantId, name)) throw new BadRequestException("Template with this name already exists");
        }
        List<SaveScheduleBuildPositionConfigRequest> configRequests = Optional.ofNullable(request.positionConfigs()).orElse(List.of());
        if (configRequests.isEmpty()) throw new BadRequestException("At least one positionConfig is required");

        Set<Long> positionIds = new HashSet<>();
        List<PreparedPositionConfig> preparedConfigs = new ArrayList<>();
        for (SaveScheduleBuildPositionConfigRequest cfg : configRequests) {
            if (cfg == null) throw new BadRequestException("positionConfig is required");
            List<Long> cfgPositionIds = normalizePositionIds(cfg);
            for (Long positionId : cfgPositionIds) {
                if (!positionIds.add(positionId)) throw new BadRequestException("Duplicate positionId in positionConfigs: " + positionId);
            }
            preparedConfigs.add(new PreparedPositionConfig(
                    cfg, cfgPositionIds, normalizeHeavyDaysOfWeek(cfg.heavyDaysOfWeek())));
        }
        Map<Long, Position> positionMap = positions.findAllById(positionIds).stream()
                .filter(p -> p.getRestaurant() != null && restaurantId.equals(p.getRestaurant().getId()))
                .collect(Collectors.toMap(Position::getId, Function.identity()));
        if (positionMap.size() != positionIds.size()) throw new BadRequestException("All positionIds must belong to restaurant");

        for (PreparedPositionConfig preparedConfig : preparedConfigs) {
            SaveScheduleBuildPositionConfigRequest cfg = preparedConfig.request();
            CanonicalBusinessInterval canonicalWorkPeriod = validateWorkPeriod(
                    cfg.workPeriodStart(), cfg.workPeriodEnd());
            if (cfg.minRestHours() != null && cfg.minRestHours() < 0)
                throw new BadRequestException("minRestHours must be >= 0");
            if (cfg.maxShiftsPerPeriod() != null && cfg.maxShiftsPerPeriod() <= 0)
                throw new BadRequestException("maxShiftsPerPeriod must be > 0");
            List<SaveScheduleBuildShiftOptionRequest> shiftOptions = Optional
                    .ofNullable(cfg.shiftOptions()).orElse(List.of());
            if (shiftOptions.isEmpty()) throw new BadRequestException("shiftOptions must not be empty");
            List<CanonicalBusinessInterval> canonicalShiftOptions = new ArrayList<>();
            for (SaveScheduleBuildShiftOptionRequest option : shiftOptions) {
                if (option == null) throw new BadRequestException("shiftOption is required");
                canonicalShiftOptions.add(validateShiftOption(
                        option, canonicalWorkPeriod, cfg.workPeriodStart(), cfg.workPeriodEnd()));
            }
            for (SaveScheduleBuildCoverageRuleRequest rule : Optional
                    .ofNullable(cfg.coverageRules()).orElse(List.of())) {
                if (rule == null) throw new BadRequestException("coverageRule is required");
                if (rule.dayOfWeek() == null || rule.dayOfWeek() < 1 || rule.dayOfWeek() > 7)
                    throw new BadRequestException("coverageRule.dayOfWeek must be 1..7");
                if (rule.requiredCount() == null || rule.requiredCount() <= 0)
                    throw new BadRequestException("coverageRule.requiredCount must be > 0");
                CanonicalBusinessInterval canonicalRule = validateCoverageRule(rule, canonicalWorkPeriod);
                validateCoverageRuleHasShiftOption(rule, canonicalRule, canonicalShiftOptions);
            }
            Set<String> dateOverrideKeys = new HashSet<>();
            for (SaveScheduleBuildCoverageDateOverrideRequest override : Optional
                    .ofNullable(cfg.coverageDateOverrides()).orElse(List.of())) {
                if (override == null) throw new BadRequestException("coverageDateOverride is required");
                if (override.date() == null) throw new BadRequestException("coverageDateOverride.date is required");
                if (override.shiftOptionIndex() == null)
                    throw new BadRequestException("coverageDateOverride.shiftOptionIndex is required");
                if (override.requiredCount() == null || override.requiredCount() < 0)
                    throw new BadRequestException("coverageDateOverride.requiredCount must be >= 0");
                if (override.shiftOptionIndex() < 0 || override.shiftOptionIndex() >= shiftOptions.size())
                    throw new BadRequestException("coverageDateOverride.shiftOptionIndex must reference a shiftOption from this positionConfig");
                String key = override.date() + ":" + override.shiftOptionIndex();
                if (!dateOverrideKeys.add(key))
                    throw new BadRequestException("Duplicate coverageDateOverride for date and shiftOption");
            }
        }
        return new PreparedTemplateRequest(name, trimToNull(request.description()),
                request.isActive() == null || request.isActive(), List.copyOf(preparedConfigs), positionMap);
    }

    private void applyPreparedRequest(ScheduleBuildTemplate template, PreparedTemplateRequest prepared) {
        template.setName(prepared.name());
        template.setDescription(prepared.description());
        template.setActive(prepared.active());

        Map<String, ScheduleBuildPositionConfig> existingByPositionKey = template.getPositionConfigs().stream()
                .filter(config -> !configPositionIds(config).isEmpty())
                .collect(Collectors.toMap(config -> positionKey(configPositionIds(config)), Function.identity(), (left, right) -> left));
        Set<ScheduleBuildPositionConfig> requestedConfigs = new HashSet<>();

        int idx = 0;
        for (PreparedPositionConfig preparedConfig : prepared.configs()) {
            SaveScheduleBuildPositionConfigRequest cfg = preparedConfig.request();
            List<SaveScheduleBuildShiftOptionRequest> shiftOptions = Optional.ofNullable(cfg.shiftOptions()).orElse(List.of());

            List<Long> cfgPositionIds = preparedConfig.positionIds();
            ScheduleBuildPositionConfig entity = existingByPositionKey.get(positionKey(cfgPositionIds));
            if (entity == null) {
                entity = new ScheduleBuildPositionConfig();
                template.getPositionConfigs().add(entity);
            }
            requestedConfigs.add(entity);
            entity.setTemplate(template);
            entity.getPositions().clear();
            cfgPositionIds.stream().map(prepared.positions()::get).forEach(entity.getPositions()::add);
            entity.setWorkPeriodStart(cfg.workPeriodStart());
            entity.setWorkPeriodEnd(cfg.workPeriodEnd());
            entity.setTargetPattern(cfg.targetPattern() == null ? ScheduleBuildPattern.NONE : cfg.targetPattern());
            entity.setMinRestHours(cfg.minRestHours());
            entity.setMinRestMode(cfg.minRestMode() == null ? ScheduleBuildMinRestMode.SOFT : cfg.minRestMode());
            entity.setMaxShiftsPerPeriod(cfg.maxShiftsPerPeriod());
            entity.getHeavyDaysOfWeek().clear();
            entity.getHeavyDaysOfWeek().addAll(preparedConfig.heavyDaysOfWeek());
            entity.setSortOrder(cfg.sortOrder() != null ? cfg.sortOrder() : idx);

            entity.getShiftOptions().clear();
            int so = 0;
            for (SaveScheduleBuildShiftOptionRequest option : shiftOptions) {
                ScheduleBuildShiftOption o = new ScheduleBuildShiftOption();
                o.setPositionConfig(entity);
                o.setStartTime(option.startTime());
                o.setEndTime(option.endTime());
                o.setLabel(trimToNull(option.label()));
                o.setSortOrder(option.sortOrder() != null ? option.sortOrder() : so++);
                entity.getShiftOptions().add(o);
            }

            entity.getCoverageRules().clear();
            int cro = 0;
            for (SaveScheduleBuildCoverageRuleRequest rule : Optional.ofNullable(cfg.coverageRules()).orElse(List.of())) {
                ScheduleBuildCoverageRule r = new ScheduleBuildCoverageRule();
                r.setPositionConfig(entity);
                r.setDayOfWeek(rule.dayOfWeek());
                r.setStartTime(rule.startTime());
                r.setEndTime(rule.endTime());
                r.setRequiredCount(rule.requiredCount());
                r.setSortOrder(rule.sortOrder() != null ? rule.sortOrder() : cro++);
                entity.getCoverageRules().add(r);
            }

            entity.getCoverageDateOverrides().clear();
            for (SaveScheduleBuildCoverageDateOverrideRequest override : Optional.ofNullable(cfg.coverageDateOverrides()).orElse(List.of())) {
                ScheduleBuildShiftOption shiftOption = entity.getShiftOptions().get(override.shiftOptionIndex());
                ScheduleBuildCoverageDateOverride dateOverride = new ScheduleBuildCoverageDateOverride();
                dateOverride.setPositionConfig(entity);
                dateOverride.setDate(override.date());
                dateOverride.setShiftOption(shiftOption);
                dateOverride.setRequiredCount(override.requiredCount());
                entity.getCoverageDateOverrides().add(dateOverride);
            }

            idx++;
        }

        template.getPositionConfigs().removeIf(config -> !requestedConfigs.contains(config));
        template.getPositionConfigs().sort(Comparator.comparing(ScheduleBuildPositionConfig::getSortOrder));
    }

    private boolean hasParentScalarChange(ScheduleBuildTemplate template, PreparedTemplateRequest prepared) {
        return !Objects.equals(template.getName(), prepared.name())
                || !Objects.equals(template.getDescription(), prepared.description())
                || template.isActive() != prepared.active();
    }

    private record PreparedTemplateRequest(String name, String description, boolean active,
                                           List<PreparedPositionConfig> configs,
                                           Map<Long, Position> positions) {}
    private record PreparedPositionConfig(SaveScheduleBuildPositionConfigRequest request,
                                          List<Long> positionIds, List<Integer> heavyDaysOfWeek) {}

    private List<Integer> normalizeHeavyDaysOfWeek(List<Integer> heavyDaysOfWeek) {
        return Optional.ofNullable(heavyDaysOfWeek).orElse(List.of()).stream()
                .peek(day -> {
                    if (day == null || day < 1 || day > 7) {
                        throw new BadRequestException("heavyDaysOfWeek values must be 1..7");
                    }
                })
                .distinct()
                .sorted()
                .toList();
    }

    private CanonicalBusinessInterval validateWorkPeriod(LocalTime start, LocalTime end) {
        if (start == null || end == null) throw new BadRequestException("workPeriod interval is required");
        return CanonicalBusinessIntervalResolver.canonicalizeWorkPeriod(start, end);
    }

    private CanonicalBusinessInterval validateShiftOption(
            SaveScheduleBuildShiftOptionRequest option,
            CanonicalBusinessInterval workPeriod,
            LocalTime workPeriodStart,
            LocalTime workPeriodEnd
    ) {
        LocalTime start = option.startTime();
        LocalTime end = option.endTime();
        if (start == null || end == null) throw new BadRequestException("shiftOption interval is required");
        if (start.equals(end)) throw new BadRequestException("shiftOption startTime must not equal endTime");
        try {
            return CanonicalBusinessIntervalResolver.resolveInside(workPeriod, start, end);
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Вариант смены " + start + "–" + end
                    + " не помещается в рабочий период " + workPeriodStart + "–" + workPeriodEnd);
        }
    }

    private CanonicalBusinessInterval validateCoverageRule(
            SaveScheduleBuildCoverageRuleRequest rule,
            CanonicalBusinessInterval workPeriod
    ) {
        LocalTime start = rule.startTime();
        LocalTime end = rule.endTime();
        if (start == null || end == null) throw new BadRequestException("coverageRule interval is required");
        if (start.equals(end)) throw new BadRequestException("coverageRule startTime must not equal endTime");
        try {
            return CanonicalBusinessIntervalResolver.resolveInside(workPeriod, start, end);
        } catch (IllegalArgumentException exception) {
            throw new BadRequestException("Правило покрытия " + rule.dayOfWeek() + " " + start + "–" + end
                    + " не помещается в рабочий период");
        }
    }

    private void validateCoverageRuleHasShiftOption(
            SaveScheduleBuildCoverageRuleRequest rule,
            CanonicalBusinessInterval coverageRule,
            List<CanonicalBusinessInterval> shiftOptions
    ) {
        boolean hasCoveringShiftOption = shiftOptions.stream()
                .anyMatch(option -> option.contains(coverageRule));
        if (!hasCoveringShiftOption) {
            throw new BadRequestException("Для правила покрытия "
                    + rule.dayOfWeek() + " "
                    + rule.startTime() + "–" + rule.endTime()
                    + " не найден подходящий вариант смены. Добавьте вариант смены, который покрывает этот интервал.");
        }
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

    /** Template-row mutex serializes every mutation with collection startup. */
    private ScheduleBuildTemplate getEditableTemplate(Long restaurantId, Long templateId) {
        ScheduleBuildTemplate template = templates.findForUpdateByIdAndRestaurantId(templateId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule build template not found: " + templateId));
        initializeTemplateCollections(template);
        return template;
    }

    private void assertExpectedVersion(ScheduleBuildTemplate template, Long expectedVersion) {
        if (expectedVersion == null || !Objects.equals(template.getVersion(), expectedVersion)) {
            throw new ScheduleBuildTemplateVersionConflictException(expectedVersion, template.getVersion());
        }
    }

    private void executeConsequences(ScheduleBuildTemplateImpactPlan plan, List<Schedule> lockedSchedules,
                                     Long actorUserId) {
        Map<Long, Schedule> byId = lockedSchedules.stream()
                .collect(Collectors.toMap(Schedule::getId, Function.identity()));
        for (var impact : plan.schedules()) {
            Schedule schedule = byId.get(impact.scheduleId());
            if (impact.action() == ScheduleBuildTemplateScheduleAction.INVALIDATE_APPLIED_AUTO_BUILD) {
                preferenceLifecycle.invalidateAppliedPreferenceDraftWithLocksHeld(
                        schedule, actorUserId, "Изменение шаблона сборки графика");
            } else if (impact.action() == ScheduleBuildTemplateScheduleAction.RESET_PREFERENCE_COLLECTION) {
                preferenceLifecycle.resetPreferenceCollectionWithLocksHeld(
                        schedule, actorUserId, "Изменение шаблона сборки графика");
            }
        }
    }

    private void initializeTemplateCollections(ScheduleBuildTemplate template) {
        for (ScheduleBuildPositionConfig positionConfig : template.getPositionConfigs()) {
            Hibernate.initialize(positionConfig.getPositions());
            Hibernate.initialize(positionConfig.getShiftOptions());
            Hibernate.initialize(positionConfig.getCoverageRules());
            Hibernate.initialize(positionConfig.getCoverageDateOverrides());
            positionConfig.getCoverageDateOverrides().forEach(override -> Hibernate.initialize(override.getShiftOption()));
            Hibernate.initialize(positionConfig.getHeavyDaysOfWeek());
        }
    }

    private ScheduleBuildTemplateDto toDto(ScheduleBuildTemplate t) {
        return new ScheduleBuildTemplateDto(t.getId(), t.getVersion(), t.getName(), t.getDescription(), t.isActive(), t.getCreatedAt(), t.getUpdatedAt(),
                t.getPositionConfigs().stream().map(pc -> new ScheduleBuildPositionConfigDto(
                        pc.getId(), configPositionIds(pc), configPositionNames(pc), pc.getWorkPeriodStart(), pc.getWorkPeriodEnd(),
                        pc.getTargetPattern(), pc.getMinRestHours(), pc.getMinRestMode(), pc.getMaxShiftsPerPeriod(),
                        pc.getHeavyDaysOfWeek() == null ? List.of() : List.copyOf(pc.getHeavyDaysOfWeek()),
                        pc.getShiftOptions().stream().map(o -> new ScheduleBuildShiftOptionDto(o.getId(), o.getStartTime(), o.getEndTime(), o.getLabel(), o.getSortOrder())).toList(),
                        pc.getCoverageRules().stream().map(r -> new ScheduleBuildCoverageRuleDto(r.getId(), r.getDayOfWeek(), r.getStartTime(), r.getEndTime(), r.getRequiredCount(), r.getSortOrder())).toList(),
                        pc.getCoverageDateOverrides().stream()
                                .map(o -> new ScheduleBuildCoverageDateOverrideDto(o.getId(), o.getDate(), shiftOptionIndex(pc, o.getShiftOption()), o.getRequiredCount()))
                                .filter(o -> o.shiftOptionIndex() != null)
                                .toList(),
                        pc.getSortOrder())).toList());
    }

    private List<Long> normalizePositionIds(SaveScheduleBuildPositionConfigRequest cfg) {
        List<Long> raw = cfg.positionIds() == null ? List.of() : cfg.positionIds();
        if (raw.isEmpty()) throw new BadRequestException("positionIds must contain at least one position");
        if (raw.stream().anyMatch(Objects::isNull)) throw new BadRequestException("positionIds must not contain null");
        List<Long> normalized = raw.stream().distinct().sorted().toList();
        if (normalized.size() != raw.size()) throw new BadRequestException("positionIds must not contain duplicates");
        return normalized;
    }

    private List<Long> configPositionIds(ScheduleBuildPositionConfig config) {
        return config.getPositions() == null ? List.of() : config.getPositions().stream()
                .map(Position::getId)
                .filter(Objects::nonNull)
                .sorted()
                .toList();
    }

    private List<String> configPositionNames(ScheduleBuildPositionConfig config) {
        return config.getPositions() == null ? List.of() : config.getPositions().stream()
                .sorted(Comparator.comparing(Position::getName, Comparator.nullsLast(String.CASE_INSENSITIVE_ORDER))
                        .thenComparing(Position::getId, Comparator.nullsLast(Comparator.naturalOrder())))
                .map(Position::getName)
                .toList();
    }

    private Integer shiftOptionIndex(ScheduleBuildPositionConfig config, ScheduleBuildShiftOption shiftOption) {
        int index = config.getShiftOptions().indexOf(shiftOption);
        return index < 0 ? null : index;
    }

    private String positionKey(List<Long> ids) {
        return ids.stream().map(String::valueOf).collect(Collectors.joining(","));
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
