package ru.staffly.common_schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Isolation;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.common_schedule.dto.*;
import ru.staffly.common_schedule.model.CommonSchedule;
import ru.staffly.common_schedule.repository.CommonScheduleRepository;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleContentMapper;
import ru.staffly.security.SecurityService;

import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional
public class CommonScheduleService {
    private final CommonScheduleRepository commonSchedules;
    private final ScheduleRepository schedules;
    private final RestaurantRepository restaurants;
    private final RestaurantMemberRepository members;
    private final ScheduleAccessService access;
    private final SecurityService security;
    private final RestaurantLifecycleMutex lifecycleMutex;
    private final ScheduleContentMapper contentMapper;

    @Transactional(readOnly = true)
    public List<CommonScheduleSummaryDto> list(Long restaurantId, Long userId) {
        security.assertRestaurantUnlocked(userId, restaurantId);
        boolean manager = access.canManageSchedules(userId, restaurantId);
        Long positionId = manager ? null : staffPosition(restaurantId, userId);
        return commonSchedules.findByRestaurantIdOrderByIdDesc(restaurantId).stream()
                .filter(c -> canView(c, manager, positionId))
                .map(this::summary)
                .sorted(Comparator.comparing(CommonScheduleSummaryDto::endDate).reversed()
                        .thenComparing(CommonScheduleSummaryDto::title, String.CASE_INSENSITIVE_ORDER)
                        .thenComparing(CommonScheduleSummaryDto::id))
                .toList();
    }

    @Transactional(readOnly = true, isolation = Isolation.REPEATABLE_READ)
    public CommonScheduleDto get(Long restaurantId, Long id, Long userId) {
        security.assertRestaurantUnlocked(userId, restaurantId);
        var common = find(restaurantId, id);
        boolean manager = access.canManageSchedules(userId, restaurantId);
        if (!canView(common, manager, manager ? null : staffPosition(restaurantId, userId))) {
            throw new ForbiddenException("Нет доступа к этому общему графику");
        }
        return details(common);
    }

    public CommonScheduleDto create(Long restaurantId, Long userId, CommonScheduleRequest request) {
        assertManage(restaurantId, userId);
        var common = new CommonSchedule();
        common.setRestaurant(restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Ресторан не найден")));
        apply(common, request, restaurantId);
        commonSchedules.saveAndFlush(common);
        return details(common);
    }

    public CommonScheduleDto update(Long restaurantId, Long id, Long userId, CommonScheduleRequest request) {
        assertManage(restaurantId, userId);
        var common = find(restaurantId, id);
        assertVersion(common, request.version());
        apply(common, request, restaurantId);
        commonSchedules.saveAndFlush(common);
        return details(common);
    }

    public void delete(Long restaurantId, Long id, Long userId, Long version) {
        assertManage(restaurantId, userId);
        var common = find(restaurantId, id);
        assertVersion(common, version);
        commonSchedules.delete(common);
    }

    private void assertManage(Long restaurantId, Long userId) {
        lifecycleMutex.lock(restaurantId);
        security.assertRestaurantUnlocked(userId, restaurantId);
        access.assertCanManageSchedules(userId, restaurantId);
    }

    private void apply(CommonSchedule common, CommonScheduleRequest request, Long restaurantId) {
        var ids = request.scheduleIds();
        if (ids == null || ids.size() < 2) {
            throw new BadRequestException("Общий график должен содержать 2 и более графиков");
        }
        if (ids.stream().anyMatch(Objects::isNull) || new HashSet<>(ids).size() != ids.size()) {
            throw new BadRequestException("Выберите разные графики");
        }
        String title = request.title() == null ? "" : request.title().trim();
        if (title.isEmpty() || title.length() > 255) {
            throw new BadRequestException("Укажите название общего графика длиной до 255 символов");
        }
        var locked = schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(restaurantId, ids);
        if (locked.size() != ids.size()) {
            throw new BadRequestException("Некоторые графики не найдены в этом ресторане");
        }
        var byId = locked.stream().collect(Collectors.toMap(Schedule::getId, Function.identity()));
        var ordered = ids.stream().map(byId::get).toList();
        var primary = ordered.get(0);
        for (var source : ordered) {
            if (source.getStatus() != ScheduleStatus.PUBLISHED) {
                throw new BadRequestException("Можно использовать только опубликованные графики");
            }
            if (source.getStartDate().isBefore(primary.getStartDate())
                    || source.getEndDate().isAfter(primary.getEndDate())) {
                throw new BadRequestException("Период графика «" + source.getTitle()
                        + "» должен целиком входить в период основного графика");
            }
        }
        common.setTitle(title);
        common.setVisibleToPositions(request.visibleToPositions());
        // Keep Hibernate's managed collection, including its order column.
        common.getSources().clear();
        common.getSources().addAll(ordered);
        common.setUpdatedAt(TimeProvider.now());
    }

    private CommonSchedule find(Long restaurantId, Long id) {
        return commonSchedules.findByIdAndRestaurantId(id, restaurantId)
                .orElseThrow(() -> new NotFoundException("Общий график не найден"));
    }

    private void assertVersion(CommonSchedule common, Long version) {
        if (version == null || !Objects.equals(common.getVersion(), version)) {
            throw new ConflictException("Общий график уже изменён. Обновите страницу и повторите действие.");
        }
    }

    private Long staffPosition(Long restaurantId, Long userId) {
        return members.findActiveByUserIdAndRestaurantId(userId, restaurantId)
                .filter(m -> m.getRole() == RestaurantRole.STAFF && m.getPosition() != null)
                .map(m -> m.getPosition().getId()).orElse(null);
    }

    private boolean canView(CommonSchedule common, boolean manager, Long positionId) {
        return manager || common.isVisibleToPositions() && positionId != null
                && common.getSources().stream().anyMatch(s -> SchedulePositionIds.ids(s).contains(positionId));
    }

    private CommonScheduleSummaryDto summary(CommonSchedule common) {
        var primary = common.primary();
        return new CommonScheduleSummaryDto(common.getId(), common.getVersion(), common.getTitle(),
                primary.getStartDate(), primary.getEndDate(), common.isVisibleToPositions(),
                common.getSources().stream().map(Schedule::getId).toList());
    }

    private CommonScheduleDto details(CommonSchedule common) {
        return new CommonScheduleDto(summary(common), common.getSources().stream().map(s -> {
            var days = s.getStartDate().datesUntil(s.getEndDate().plusDays(1)).toList();
            return new CommonScheduleDto.Source(s.getId(), s.getVersion(), s.getTitle(),
                    contentMapper.toContent(s, days));
        }).toList());
    }
}
