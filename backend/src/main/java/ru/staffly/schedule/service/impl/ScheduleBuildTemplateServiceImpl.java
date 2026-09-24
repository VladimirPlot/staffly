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
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
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
    private final RestaurantMemberRepository members;
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
        Map<Long, RestaurantMember> lockedMembers = lockRequestedMembers(restaurantId, extractMarkerMemberIds(request));
        ScheduleBuildTemplate template = new ScheduleBuildTemplate();
        template.setRestaurant(restaurant);
        applyPreparedRequest(template, prepareRequest(template, restaurantId, request, true, lockedMembers, true));
        return toDto(templates.save(template));
    }
    @Override
    public ScheduleBuildTemplateDto update(Long restaurantId, Long templateId, Long actorUserId, SaveScheduleBuildTemplateRequest request) {
        assertManageAccess(restaurantId, actorUserId);
        if (request == null) {
            throw new BadRequestException("request body is required");
        }
        // This snapshot is fail-fast only. It is deliberately not a mutation mutex or a
        // concurrency authority; the version and all state-dependent decisions are repeated
        // against the pessimistically locked aggregate below.
        ScheduleBuildTemplate optimisticTemplate = getTemplate(restaurantId, templateId);
        assertExpectedVersion(optimisticTemplate, request.expectedVersion());
        List<Long> requestedMemberIds = extractMarkerMemberIds(request);
        prepareRequest(optimisticTemplate, restaurantId, request, false, Map.of(), false);
        // Ensure the later locking query cannot be satisfied by this persistence-context
        // snapshot. Cascade DETACH removes the initialized aggregate children as well.
        entityManager.detach(optimisticTemplate);

        // Global mutation order starts with RestaurantMember. These row locks make current
        // restaurant/position authoritative until marker membership has been persisted.
        Map<Long, RestaurantMember> lockedMembers = lockRequestedMembers(restaurantId, requestedMemberIds);

        // Discovery is deliberately lock-free and is only an acquisition candidate set.  In
        // particular, do not load/lock the template before the Schedule aggregate mutexes.
        List<Long> linkedIds = canonicalIds(schedules
                .findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(restaurantId, templateId));
        List<Schedule> lockedSchedules = linkedIds.isEmpty() ? List.of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, linkedIds);

        ScheduleBuildTemplate template = getEditableTemplate(restaurantId, templateId);
        assertExpectedVersion(template, request.expectedVersion());

        List<Long> lockedIds = canonicalIds(lockedSchedules.stream().map(Schedule::getId).toList());
        List<Long> authoritativeLinkedIds = schedules
                .findIdsByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(restaurantId, templateId);
        authoritativeLinkedIds = canonicalIds(authoritativeLinkedIds);
        if (!linkedIds.equals(lockedIds) || !linkedIds.equals(authoritativeLinkedIds)) {
            throw new ScheduleDomainConflictException("SCHEDULE_BUILD_TEMPLATE_LINKAGE_CHANGED",
                    "Состав связанных графиков изменился. Повторите действие.");
        }

        // Re-run the existing preparation boundary because name uniqueness is conditional on
        // current persisted state. The resulting representation belongs to the final locked
        // aggregate; no mutation decision relies on the optimistic snapshot.
        PreparedTemplateRequest prepared = prepareRequest(template, restaurantId, request, false, lockedMembers, true);
        ScheduleBuildTemplateImpactPlan plan = impactPlanner.plan(template, request, lockedSchedules);
        boolean parentScalarChange = hasParentScalarChange(template, prepared);
        boolean persistenceCorrelationChange = hasPersistenceCorrelationChange(template, prepared);
        if (plan.impact() == ru.staffly.schedule.service.ScheduleBuildTemplateChangeImpact.NONE
                && !parentScalarChange && !persistenceCorrelationChange) {
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
                                                    SaveScheduleBuildTemplateRequest request, boolean creating,
                                                    Map<Long, RestaurantMember> lockedMembers,
                                                    boolean validateMarkerMembers) {
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
        Set<Long> requestedConfigIds = new HashSet<>();
        List<PreparedPositionConfig> preparedConfigs = new ArrayList<>();
        Map<Long, ScheduleBuildPositionConfig> existingConfigs = template.getPositionConfigs().stream()
                .filter(config -> config.getId() != null)
                .collect(Collectors.toMap(ScheduleBuildPositionConfig::getId, Function.identity()));
        for (SaveScheduleBuildPositionConfigRequest cfg : configRequests) {
            if (cfg == null) throw new BadRequestException("positionConfig is required");
            if (cfg.id() != null && !requestedConfigIds.add(cfg.id())) {
                throw new BadRequestException("Duplicate positionConfig id: " + cfg.id());
            }
            ScheduleBuildPositionConfig existingConfig = cfg.id() == null ? null : existingConfigs.get(cfg.id());
            if (validateMarkerMembers && cfg.id() != null && existingConfig == null) {
                throw new BadRequestException("positionConfig id does not belong to template: " + cfg.id());
            }
            List<Long> cfgPositionIds = normalizePositionIds(cfg);
            for (Long positionId : cfgPositionIds) {
                if (!positionIds.add(positionId)) throw new BadRequestException("Duplicate positionId in positionConfigs: " + positionId);
            }
            List<PreparedMarker> preparedMarkers = prepareMarkers(
                    cfg, cfgPositionIds, existingConfig, lockedMembers, validateMarkerMembers);
            preparedConfigs.add(new PreparedPositionConfig(
                    cfg, cfgPositionIds, normalizeHeavyDaysOfWeek(cfg.heavyDaysOfWeek()), preparedMarkers));
        }
        Map<Long, Position> positionMap = positions.findAllById(positionIds).stream()
                .filter(p -> p.getRestaurant() != null && restaurantId.equals(p.getRestaurant().getId()))
                .collect(Collectors.toMap(Position::getId, Function.identity()));
        if (positionMap.size() != positionIds.size()) throw new BadRequestException("All positionIds must belong to restaurant");

        for (PreparedPositionConfig preparedConfig : preparedConfigs) {
            SaveScheduleBuildPositionConfigRequest cfg = preparedConfig.request();
            if (cfg.minRestHours() != null && cfg.minRestHours() < 0) throw new BadRequestException("minRestHours must be >= 0");
            if (cfg.maxShiftsPerPeriod() != null && cfg.maxShiftsPerPeriod() <= 0) throw new BadRequestException("maxShiftsPerPeriod must be > 0");
            List<SaveScheduleBuildWeekdayRegimeRequest> regimes = Optional.ofNullable(cfg.weekdayRegimes()).orElse(List.of());
            if (regimes.isEmpty()) throw new BadRequestException("weekdayRegimes must not be empty");
            EnumSet<java.time.DayOfWeek> covered = EnumSet.noneOf(java.time.DayOfWeek.class);
            for (SaveScheduleBuildWeekdayRegimeRequest regime : regimes) {
                if (regime == null) throw new BadRequestException("weekdayRegime is required");
                List<java.time.DayOfWeek> days = Optional.ofNullable(regime.daysOfWeek()).orElse(List.of());
                if (days.isEmpty()) throw new BadRequestException("weekdayRegime.daysOfWeek must not be empty");
                if (days.stream().anyMatch(Objects::isNull) || new HashSet<>(days).size() != days.size()) throw new BadRequestException("weekdayRegime.daysOfWeek must not contain null or duplicates");
                for (java.time.DayOfWeek day : days) if (!covered.add(day)) throw new BadRequestException("Weekday must occur in exactly one regime: " + day);
                validateRegime(regime, new HashSet<>(days), preparedConfig.markers().size());
            }
            if (!covered.equals(EnumSet.allOf(java.time.DayOfWeek.class))) throw new BadRequestException("weekdayRegimes must cover all seven weekdays exactly once");
        }
        return new PreparedTemplateRequest(name, trimToNull(request.description()),
                request.isActive() == null || request.isActive(), List.copyOf(preparedConfigs), positionMap,
                Map.copyOf(lockedMembers));
    }

    private List<PreparedMarker> prepareMarkers(SaveScheduleBuildPositionConfigRequest config,
                                                List<Long> positionIds,
                                                ScheduleBuildPositionConfig existingConfig,
                                                Map<Long, RestaurantMember> lockedMembers,
                                                boolean validateMembers) {
        Set<String> names = new HashSet<>();
        Set<Long> markerIds = new HashSet<>();
        Map<Long, ScheduleBuildMarker> existingMarkers = existingConfig == null ? Map.of()
                : existingConfig.getMarkers().stream().filter(marker -> marker.getId() != null)
                .collect(Collectors.toMap(ScheduleBuildMarker::getId, Function.identity()));
        List<PreparedMarker> result = new ArrayList<>();
        for (SaveScheduleBuildMarkerRequest marker : Optional.ofNullable(config.markers()).orElse(List.of())) {
            if (marker == null) throw new BadRequestException("marker is required");
            if (marker.id() != null && !markerIds.add(marker.id())) {
                throw new BadRequestException("Duplicate marker id: " + marker.id());
            }
            ScheduleBuildMarker existingMarker = marker.id() == null ? null : existingMarkers.get(marker.id());
            if (validateMembers && marker.id() != null && existingMarker == null) {
                throw new BadRequestException("marker id does not belong to positionConfig: " + marker.id());
            }
            String name = Optional.ofNullable(marker.name()).map(String::trim).orElse("");
            if (name.isEmpty()) throw new BadRequestException("marker.name is required");
            if (name.length() > 100) throw new BadRequestException("marker.name must not exceed 100 characters");
            if (!names.add(name.toLowerCase(Locale.ROOT))) {
                throw new BadRequestException("Marker names must be unique within a positionConfig (case-insensitive)");
            }
            List<Long> memberIds = normalizeMarkerMemberIds(marker.memberIds());
            Set<Long> previousMemberIds = existingMarker == null ? Set.of() : existingMarker.getMembers().stream()
                    .map(RestaurantMember::getId).collect(Collectors.toSet());
            List<Long> effectiveMemberIds = new ArrayList<>();
            for (Long memberId : validateMembers ? memberIds : List.<Long>of()) {
                RestaurantMember member = lockedMembers.get(memberId);
                if (member == null) throw new BadRequestException("All marker memberIds must belong to restaurant");
                Long currentPositionId = member.getPosition() == null ? null : member.getPosition().getId();
                if (!positionIds.contains(currentPositionId)) {
                    if (existingMarker != null && previousMemberIds.contains(memberId)) {
                        continue;
                    }
                    throw new BadRequestException("Marker member current position must belong to positionConfig: " + memberId);
                }
                effectiveMemberIds.add(memberId);
            }
            result.add(new PreparedMarker(marker.id(), name,
                    validateMembers ? List.copyOf(effectiveMemberIds) : memberIds));
        }
        return List.copyOf(result);
    }

    private List<Long> extractMarkerMemberIds(SaveScheduleBuildTemplateRequest request) {
        if (request == null) throw new BadRequestException("request body is required");
        List<Long> result = new ArrayList<>();
        for (SaveScheduleBuildPositionConfigRequest config : Optional.ofNullable(request.positionConfigs()).orElse(List.of())) {
            if (config == null) continue;
            for (SaveScheduleBuildMarkerRequest marker : Optional.ofNullable(config.markers()).orElse(List.of())) {
                if (marker == null) continue;
                result.addAll(normalizeMarkerMemberIds(marker.memberIds()));
            }
        }
        return canonicalIds(result);
    }

    private List<Long> normalizeMarkerMemberIds(List<Long> rawIds) {
        List<Long> raw = Optional.ofNullable(rawIds).orElse(List.of());
        if (raw.stream().anyMatch(Objects::isNull)) throw new BadRequestException("marker.memberIds must not contain null");
        List<Long> normalized = raw.stream().distinct().sorted().toList();
        if (normalized.size() != raw.size()) throw new BadRequestException("marker.memberIds must not contain duplicates");
        return normalized;
    }

    private Map<Long, RestaurantMember> lockRequestedMembers(Long restaurantId, List<Long> memberIds) {
        if (memberIds.isEmpty()) return Map.of();
        List<RestaurantMember> locked = members.findForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, memberIds);
        if (locked.size() != memberIds.size()) {
            throw new BadRequestException("All marker memberIds must exist and belong to restaurant");
        }
        List<Long> lockedIds = locked.stream().map(RestaurantMember::getId).toList();
        if (!lockedIds.equals(memberIds)) {
            throw new IllegalStateException("RestaurantMember lock query must return requested rows in ascending order");
        }
        return locked.stream().collect(Collectors.toMap(RestaurantMember::getId, Function.identity()));
    }

    private void applyPreparedRequest(ScheduleBuildTemplate template, PreparedTemplateRequest prepared) {
        template.setName(prepared.name());
        template.setDescription(prepared.description());
        template.setActive(prepared.active());

        Map<Long, ScheduleBuildPositionConfig> existingById = template.getPositionConfigs().stream()
                .filter(config -> config.getId() != null)
                .collect(Collectors.toMap(ScheduleBuildPositionConfig::getId, Function.identity()));
        Set<ScheduleBuildPositionConfig> requestedConfigs = new HashSet<>();

        int idx = 0;
        for (PreparedPositionConfig preparedConfig : prepared.configs()) {
            SaveScheduleBuildPositionConfigRequest cfg = preparedConfig.request();
            List<Long> cfgPositionIds = preparedConfig.positionIds();
            ScheduleBuildPositionConfig entity = cfg.id() == null ? null : existingById.get(cfg.id());
            if (entity == null) {
                entity = new ScheduleBuildPositionConfig();
                template.getPositionConfigs().add(entity);
            }
            requestedConfigs.add(entity);
            entity.setTemplate(template);
            entity.getPositions().clear();
            cfgPositionIds.stream().map(prepared.positions()::get).forEach(entity.getPositions()::add);
            entity.setTargetPattern(cfg.targetPattern() == null ? ScheduleBuildPattern.NONE : cfg.targetPattern());
            entity.setMinRestHours(cfg.minRestHours());
            entity.setMinRestMode(cfg.minRestMode() == null ? ScheduleBuildMinRestMode.SOFT : cfg.minRestMode());
            entity.setMaxShiftsPerPeriod(cfg.maxShiftsPerPeriod());
            entity.getHeavyDaysOfWeek().clear();
            entity.getHeavyDaysOfWeek().addAll(preparedConfig.heavyDaysOfWeek());
            entity.setSortOrder(cfg.sortOrder() != null ? cfg.sortOrder() : idx);
            Map<Long, ScheduleBuildMarker> existingMarkers = entity.getMarkers().stream()
                    .filter(marker -> marker.getId() != null)
                    .collect(Collectors.toMap(ScheduleBuildMarker::getId, Function.identity()));
            Set<ScheduleBuildMarker> requestedMarkers = new HashSet<>();
            List<ScheduleBuildMarker> markersByRequestIndex = new ArrayList<>();
            for (PreparedMarker requestedMarker : preparedConfig.markers()) {
                ScheduleBuildMarker marker = requestedMarker.id() == null
                        ? new ScheduleBuildMarker() : existingMarkers.get(requestedMarker.id());
                if (marker == null) {
                    throw new IllegalStateException("Prepared marker correlation was not authoritative");
                }
                if (requestedMarker.id() == null) entity.getMarkers().add(marker);
                requestedMarkers.add(marker);
                markersByRequestIndex.add(marker);
                marker.setPositionConfig(entity);
                marker.setName(requestedMarker.name());
                marker.getMembers().clear();
                requestedMarker.memberIds().stream().map(prepared.members()::get).forEach(marker.getMembers()::add);
            }
            entity.getMarkers().removeIf(marker -> !requestedMarkers.contains(marker));
            entity.getWeekdayRegimes().clear();
            int regimeOrder = 0;
            for (SaveScheduleBuildWeekdayRegimeRequest requestRegime : cfg.weekdayRegimes()) {
                ScheduleBuildWeekdayRegime regime = new ScheduleBuildWeekdayRegime();
                regime.setPositionConfig(entity);
                regime.getDaysOfWeek().addAll(requestRegime.daysOfWeek().stream().sorted().toList());
                regime.setWorkPeriodStart(requestRegime.workPeriodStart()); regime.setWorkPeriodEnd(requestRegime.workPeriodEnd());
                regime.setSortOrder(requestRegime.sortOrder() == null ? regimeOrder++ : requestRegime.sortOrder());
                int shiftOrder = 0;
                for (SaveScheduleBuildShiftOptionRequest option : requestRegime.shiftOptions()) {
                    ScheduleBuildShiftOption child = new ScheduleBuildShiftOption(); child.setWeekdayRegime(regime);
                    child.setStartTime(option.startTime()); child.setEndTime(option.endTime()); child.setLabel(trimToNull(option.label()));
                    child.setMarker(option.markerIndex() == null ? null : markersByRequestIndex.get(option.markerIndex()));
                    child.setSortOrder(option.sortOrder() == null ? shiftOrder++ : option.sortOrder()); regime.getShiftOptions().add(child);
                }
                int coverageOrder = 0;
                for (SaveScheduleBuildCoverageRuleRequest rule : Optional.ofNullable(requestRegime.coverageRules()).orElse(List.of())) {
                    ScheduleBuildCoverageRule child = new ScheduleBuildCoverageRule(); child.setWeekdayRegime(regime); child.setDayOfWeek(rule.dayOfWeek());
                    child.setStartTime(rule.startTime()); child.setEndTime(rule.endTime()); child.setRequiredCount(rule.requiredCount());
                    child.setSortOrder(rule.sortOrder() == null ? coverageOrder++ : rule.sortOrder()); regime.getCoverageRules().add(child);
                }
                for (SaveScheduleBuildCoverageDateOverrideRequest override : Optional.ofNullable(requestRegime.coverageDateOverrides()).orElse(List.of())) {
                    ScheduleBuildCoverageDateOverride child = new ScheduleBuildCoverageDateOverride(); child.setWeekdayRegime(regime); child.setDate(override.date());
                    child.setShiftOption(regime.getShiftOptions().get(override.shiftOptionIndex())); child.setRequiredCount(override.requiredCount()); regime.getCoverageDateOverrides().add(child);
                }
                entity.getWeekdayRegimes().add(regime);
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

    /**
     * Persistence correlation is deliberately outside semantic classification, but a full-replacement
     * request containing a null id still has to replace the corresponding persisted child.
     */
    private boolean hasPersistenceCorrelationChange(ScheduleBuildTemplate template, PreparedTemplateRequest prepared) {
        Set<Long> currentConfigIds = template.getPositionConfigs().stream()
                .map(ScheduleBuildPositionConfig::getId).filter(Objects::nonNull).collect(Collectors.toSet());
        Set<Long> requestedConfigIds = prepared.configs().stream().map(config -> config.request().id())
                .filter(Objects::nonNull).collect(Collectors.toSet());
        if (prepared.configs().stream().anyMatch(config -> config.request().id() == null)
                || !currentConfigIds.equals(requestedConfigIds)) {
            return true;
        }
        Map<Long, Set<Long>> currentMarkerIds = template.getPositionConfigs().stream()
                .filter(config -> config.getId() != null)
                .collect(Collectors.toMap(ScheduleBuildPositionConfig::getId, config -> config.getMarkers().stream()
                        .map(ScheduleBuildMarker::getId).filter(Objects::nonNull).collect(Collectors.toSet())));
        for (PreparedPositionConfig config : prepared.configs()) {
            if (config.markers().stream().anyMatch(marker -> marker.id() == null)) return true;
            Set<Long> requestedMarkerIds = config.markers().stream().map(PreparedMarker::id)
                    .filter(Objects::nonNull).collect(Collectors.toSet());
            if (!Objects.equals(currentMarkerIds.get(config.request().id()), requestedMarkerIds)) return true;
        }
        return false;
    }

    private record PreparedTemplateRequest(String name, String description, boolean active,
                                           List<PreparedPositionConfig> configs,
                                           Map<Long, Position> positions,
                                           Map<Long, RestaurantMember> members) {}
    private record PreparedPositionConfig(SaveScheduleBuildPositionConfigRequest request,
                                          List<Long> positionIds, List<Integer> heavyDaysOfWeek,
                                          List<PreparedMarker> markers) {}
    private record PreparedMarker(Long id, String name, List<Long> memberIds) {}

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

    private void validateRegime(SaveScheduleBuildWeekdayRegimeRequest regime, Set<java.time.DayOfWeek> days,
                                int markerCount) {
        CanonicalBusinessInterval workPeriod = validateWorkPeriod(regime.workPeriodStart(), regime.workPeriodEnd());
        List<SaveScheduleBuildShiftOptionRequest> options = Optional.ofNullable(regime.shiftOptions()).orElse(List.of());
        if (options.isEmpty()) throw new BadRequestException("weekdayRegime.shiftOptions must not be empty");
        List<CanonicalBusinessInterval> canonicalOptions = new ArrayList<>(); Set<String> geometry = new HashSet<>();
        for (SaveScheduleBuildShiftOptionRequest option : options) {
            if (option == null) throw new BadRequestException("shiftOption is required");
            CanonicalBusinessInterval canonical = validateShiftOption(option, workPeriod, regime.workPeriodStart(), regime.workPeriodEnd());
            if (option.markerIndex() != null
                    && (option.markerIndex() < 0 || option.markerIndex() >= markerCount)) {
                throw new BadRequestException("shiftOption.markerIndex must reference a marker from its positionConfig");
            }
            if (!geometry.add(canonical.startMinute() + ":" + canonical.endMinute())) throw new BadRequestException("Duplicate equivalent shiftOption in weekdayRegime");
            canonicalOptions.add(canonical);
        }
        for (SaveScheduleBuildCoverageRuleRequest rule : Optional.ofNullable(regime.coverageRules()).orElse(List.of())) {
            if (rule == null || rule.dayOfWeek() == null || rule.dayOfWeek() < 1 || rule.dayOfWeek() > 7) throw new BadRequestException("coverageRule.dayOfWeek must be 1..7");
            if (!days.contains(java.time.DayOfWeek.of(rule.dayOfWeek()))) throw new BadRequestException("coverageRule weekday must belong to its weekdayRegime");
            if (rule.requiredCount() == null || rule.requiredCount() <= 0) throw new BadRequestException("coverageRule.requiredCount must be > 0");
            CanonicalBusinessInterval canonical = validateCoverageRule(rule, workPeriod); validateCoverageRuleHasShiftOption(rule, canonical, canonicalOptions);
        }
        Set<String> keys = new HashSet<>();
        for (SaveScheduleBuildCoverageDateOverrideRequest override : Optional.ofNullable(regime.coverageDateOverrides()).orElse(List.of())) {
            if (override == null || override.date() == null) throw new BadRequestException("coverageDateOverride.date is required");
            if (!days.contains(override.date().getDayOfWeek())) throw new BadRequestException("coverageDateOverride date must belong to its weekdayRegime");
            if (override.shiftOptionIndex() == null || override.shiftOptionIndex() < 0 || override.shiftOptionIndex() >= options.size()) throw new BadRequestException("coverageDateOverride.shiftOptionIndex must reference a shiftOption from its weekdayRegime");
            if (override.requiredCount() == null || override.requiredCount() < 0) throw new BadRequestException("coverageDateOverride.requiredCount must be >= 0");
            if (!keys.add(override.date() + ":" + override.shiftOptionIndex())) throw new BadRequestException("Duplicate coverageDateOverride for date and shiftOption");
        }
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

    private List<Long> canonicalIds(Collection<Long> ids) {
        return ids == null ? List.of() : ids.stream()
                .filter(Objects::nonNull)
                .distinct()
                .sorted()
                .toList();
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
            Hibernate.initialize(positionConfig.getMarkers());
            positionConfig.getMarkers().forEach(marker -> Hibernate.initialize(marker.getMembers()));
            Hibernate.initialize(positionConfig.getWeekdayRegimes());
            for (ScheduleBuildWeekdayRegime regime : positionConfig.getWeekdayRegimes()) {
                Hibernate.initialize(regime.getDaysOfWeek()); Hibernate.initialize(regime.getShiftOptions());
                Hibernate.initialize(regime.getCoverageRules()); Hibernate.initialize(regime.getCoverageDateOverrides());
                regime.getCoverageDateOverrides().forEach(override -> Hibernate.initialize(override.getShiftOption()));
            }
            Hibernate.initialize(positionConfig.getHeavyDaysOfWeek());
        }
    }

    private ScheduleBuildTemplateDto toDto(ScheduleBuildTemplate t) {
        return new ScheduleBuildTemplateDto(t.getId(), t.getVersion(), t.getName(), t.getDescription(), t.isActive(), t.getCreatedAt(), t.getUpdatedAt(),
                t.getPositionConfigs().stream().map(pc -> new ScheduleBuildPositionConfigDto(pc.getId(), configPositionIds(pc), configPositionNames(pc), pc.getTargetPattern(),
                        pc.getMinRestHours(), pc.getMinRestMode(), pc.getMaxShiftsPerPeriod(), pc.getHeavyDaysOfWeek() == null ? List.of() : List.copyOf(pc.getHeavyDaysOfWeek()),
                        pc.getWeekdayRegimes().stream().map(regime -> new ScheduleBuildWeekdayRegimeDto(regime.getId(), regime.getDaysOfWeek().stream().sorted().toList(),
                                regime.getWorkPeriodStart(), regime.getWorkPeriodEnd(),
                                regime.getShiftOptions().stream().map(o -> new ScheduleBuildShiftOptionDto(o.getId(), o.getStartTime(), o.getEndTime(), o.getLabel(), o.getSortOrder(),
                                        o.getMarker() == null ? null : o.getMarker().getId())).toList(),
                                regime.getCoverageRules().stream().map(r -> new ScheduleBuildCoverageRuleDto(r.getId(), r.getDayOfWeek(), r.getStartTime(), r.getEndTime(), r.getRequiredCount(), r.getSortOrder())).toList(),
                                regime.getCoverageDateOverrides().stream().map(o -> new ScheduleBuildCoverageDateOverrideDto(o.getId(), o.getDate(), shiftOptionIndex(regime, o.getShiftOption()), o.getRequiredCount())).toList(),
                                regime.getSortOrder())).toList(),
                        pc.getMarkers().stream().map(marker -> new ScheduleBuildMarkerDto(marker.getId(), marker.getName(),
                                marker.getMembers().stream().map(RestaurantMember::getId).sorted().toList())).toList(),
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

    private Integer shiftOptionIndex(ScheduleBuildWeekdayRegime regime, ScheduleBuildShiftOption shiftOption) {
        int index = regime.getShiftOptions().indexOf(shiftOption);
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
