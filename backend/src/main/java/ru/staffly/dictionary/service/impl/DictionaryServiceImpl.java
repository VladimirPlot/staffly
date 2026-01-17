package ru.staffly.dictionary.service.impl;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.dictionary.dto.PositionDto;
import ru.staffly.dictionary.dto.ShiftDto;
import ru.staffly.dictionary.mapper.PositionMapper;
import ru.staffly.dictionary.mapper.ShiftMapper;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.model.Shift;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.dictionary.repository.ShiftRepository;
import ru.staffly.dictionary.service.DictionaryService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;

import java.util.Comparator;
import java.util.List;

@Service
@RequiredArgsConstructor
public class DictionaryServiceImpl implements DictionaryService {

    private final PositionRepository positions;
    private final ShiftRepository shifts;
    private final RestaurantRepository restaurants;
    private final PositionMapper positionMapper;
    private final ShiftMapper shiftMapper;
    private final SecurityService security;

    /* ===================== Positions ===================== */

    @Override
    @Transactional
    public PositionDto createPosition(Long restaurantId, Long currentUserId, PositionDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);
        RestaurantRole level = dto.level() != null ? dto.level() : RestaurantRole.STAFF;

        boolean isAdmin = security.isAdmin(currentUserId, restaurantId);
        if (!isAdmin && level != RestaurantRole.STAFF) {
            throw new ForbiddenException("Managers can create only STAFF-level positions");
        }

        Restaurant r = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        String name = normName(dto.name());
        if (name == null || name.isBlank()) {
            throw new ConflictException("Position name is required");
        }
        if (positions.existsByRestaurantIdAndNameIgnoreCase(restaurantId, name)) {
            throw new ConflictException("Position already exists: " + name);
        }

        Position p = positionMapper.toEntity(
                new PositionDto(dto.id(), restaurantId, name, Boolean.TRUE, level, dto.payType(), dto.payRate(), dto.normHours()),
                r
        );
        p = positions.save(p);
        return positionMapper.toDto(p);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<PositionDto> listPositions(Long restaurantId, Long currentUserId, boolean includeInactive) {
        boolean allowInactive = includeInactive && security.hasAtLeastManager(currentUserId, restaurantId);

        if (!allowInactive) {
            // даже если фронт по ошибке запросил includeInactive=true, участнику всё равно
            // нужно видеть активные должности без ошибки доступа
            security.assertMember(currentUserId, restaurantId);
        }

        return (allowInactive
                ? positions.findByRestaurantId(restaurantId)
                : positions.findByRestaurantIdAndActiveTrue(restaurantId))
                .stream()
                .map(positionMapper::toDto)
                .sorted(Comparator.comparing(PositionDto::name, String.CASE_INSENSITIVE_ORDER))
                .toList();
    }

    @Override
    @Transactional
    public PositionDto updatePosition(Long restaurantId, Long currentUserId, Long positionId, PositionDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Position p = positions.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position not found: " + positionId));
        if (!p.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Position not found in this restaurant");
        }

        String newName = normName(dto.name());
        if (newName != null && !newName.equalsIgnoreCase(p.getName())
                && positions.existsByRestaurantIdAndNameIgnoreCase(restaurantId, newName)) {
            throw new ConflictException("Position already exists: " + newName);
        }

        boolean isAdmin = security.isAdmin(currentUserId, restaurantId);
        if (!isAdmin && p.getLevel() != RestaurantRole.STAFF) {
            throw new ForbiddenException("Managers cannot edit ADMIN/MANAGER positions");
        }

        RestaurantRole newLevel = dto.level() != null ? dto.level() : p.getLevel();
        if (!isAdmin && newLevel != RestaurantRole.STAFF) {
            throw new ForbiddenException("Managers can set only STAFF-level positions");
        }

        positionMapper.updateEntity(
                p,
                new PositionDto(dto.id(), restaurantId,
                        newName != null ? newName : p.getName(),
                        dto.active(),
                        newLevel,
                        dto.payType(),
                        dto.payRate(),
                        dto.normHours()),
                p.getRestaurant()
        );
        p = positions.save(p);
        return positionMapper.toDto(p);
    }

    @Override
    @Transactional
    public void deletePosition(Long restaurantId, Long currentUserId, Long positionId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Position p = positions.findById(positionId)
                .orElseThrow(() -> new NotFoundException("Position not found: " + positionId));
        if (!p.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Position not found in this restaurant");
        }

        boolean isAdmin = security.isAdmin(currentUserId, restaurantId);
        if (!isAdmin && p.getLevel() != RestaurantRole.STAFF) {
            throw new ForbiddenException("Managers cannot delete ADMIN/MANAGER positions");
        }

        p.setActive(false);
        positions.save(p);
    }

    /* ===================== Shifts ===================== */

    @Override
    @Transactional
    public ShiftDto createShift(Long restaurantId, Long currentUserId, ShiftDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        validateShiftTimes(dto);

        Restaurant r = restaurants.findById(restaurantId)
                .orElseThrow(() -> new NotFoundException("Restaurant not found: " + restaurantId));

        String name = normName(dto.name());
        if (name == null || name.isBlank()) {
            throw new ConflictException("Shift name is required");
        }
        if (shifts.existsByRestaurantIdAndNameIgnoreCase(restaurantId, name)) {
            throw new ConflictException("Shift already exists: " + name);
        }

        Shift s = shiftMapper.toEntity(
                new ShiftDto(dto.id(), restaurantId, name, dto.startTime(), dto.endTime(), dto.active()),
                r
        );
        s = shifts.save(s);
        return shiftMapper.toDto(s);
    }

    @Override
    @Transactional(Transactional.TxType.SUPPORTS)
    public List<ShiftDto> listShifts(Long restaurantId, Long currentUserId) {
        security.assertMember(currentUserId, restaurantId);
        return shifts.findByRestaurantIdAndActiveTrue(restaurantId)
                .stream().map(shiftMapper::toDto).toList();
    }

    @Override
    @Transactional
    public ShiftDto updateShift(Long restaurantId, Long currentUserId, Long shiftId, ShiftDto dto) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Shift s = shifts.findById(shiftId)
                .orElseThrow(() -> new NotFoundException("Shift not found: " + shiftId));
        if (!s.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Shift not found in this restaurant");
        }

        validateShiftTimes(dto);

        String newName = normName(dto.name());
        if (newName != null && !newName.equalsIgnoreCase(s.getName())
                && shifts.existsByRestaurantIdAndNameIgnoreCase(restaurantId, newName)) {
            throw new ConflictException("Shift already exists: " + newName);
        }

        shiftMapper.updateEntity(
                s,
                new ShiftDto(dto.id(), restaurantId, newName != null ? newName : s.getName(), dto.startTime(), dto.endTime(), dto.active()),
                s.getRestaurant()
        );
        s = shifts.save(s);
        return shiftMapper.toDto(s);
    }

    @Override
    @Transactional
    public void deleteShift(Long restaurantId, Long currentUserId, Long shiftId) {
        security.assertAtLeastManager(currentUserId, restaurantId);

        Shift s = shifts.findById(shiftId)
                .orElseThrow(() -> new NotFoundException("Shift not found: " + shiftId));
        if (!s.getRestaurant().getId().equals(restaurantId)) {
            throw new NotFoundException("Shift not found in this restaurant");
        }

        s.setActive(false);
        shifts.save(s);
    }

    /* ===================== Helpers ===================== */

    private String normName(String s) {
        return s == null ? null : s.trim();
    }

    /** Разрешаем ночные смены (end < start => следующий день). Запрещаем 0 и >18ч. */
    private void validateShiftTimes(ShiftDto dto) {
        var start = dto.startTime();
        var end   = dto.endTime();

        if (start == null || end == null) {
            throw new ConflictException("startTime and endTime are required");
        }
        if (start.equals(end)) {
            throw new ConflictException("startTime cannot equal endTime");
        }

        int startMin = start.getHour() * 60 + start.getMinute();
        int endMin   = end.getHour() * 60 + end.getMinute();
        int duration = endMin >= startMin ? (endMin - startMin) : (1440 - startMin + endMin);

        if (duration <= 0 || duration > 18 * 60) {
            throw new ConflictException("Shift duration must be between 1 minute and 18 hours");
        }
    }
}