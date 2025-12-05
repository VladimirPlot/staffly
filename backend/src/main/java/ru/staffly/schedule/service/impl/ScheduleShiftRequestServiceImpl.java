package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.ForbiddenException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.notification.model.Notification;
import ru.staffly.notification.repository.NotificationRepository;
import ru.staffly.schedule.dto.CreateReplacementShiftRequest;
import ru.staffly.schedule.dto.CreateSwapShiftRequest;
import ru.staffly.schedule.dto.ShiftRequestDto;
import ru.staffly.schedule.dto.ShiftRequestMemberDto;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleCell;
import ru.staffly.schedule.model.ScheduleRow;
import ru.staffly.schedule.model.ScheduleShiftRequest;
import ru.staffly.schedule.model.ScheduleShiftRequestStatus;
import ru.staffly.schedule.model.ScheduleShiftRequestType;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.repository.ScheduleShiftRequestRepository;
import ru.staffly.schedule.service.ScheduleShiftRequestService;
import ru.staffly.security.SecurityService;
import ru.staffly.restaurant.model.RestaurantRole;
import ru.staffly.user.model.User;

import java.time.LocalDate;
import java.util.ArrayList;
import java.util.HashSet;
import java.util.List;
import java.util.Objects;
import java.util.Optional;
import java.util.Set;

@Service
@RequiredArgsConstructor
@Transactional
public class ScheduleShiftRequestServiceImpl implements ScheduleShiftRequestService {

    private static final List<ScheduleShiftRequestStatus> ACTIVE_STATUSES = List.of(
            ScheduleShiftRequestStatus.PENDING_MANAGER
    );

    private final ScheduleRepository schedules;
    private final ScheduleShiftRequestRepository requests;
    private final RestaurantMemberRepository members;
    private final NotificationRepository notifications;
    private final SecurityService securityService;

    @Override
    public ShiftRequestDto createReplacement(Long restaurantId, Long scheduleId, Long userId, CreateReplacementShiftRequest request) {
        RestaurantMember initiator = requireMember(userId, restaurantId);
        Schedule schedule = loadSchedule(scheduleId, restaurantId);

        LocalDate day = parseDate(request.day(), "day");
        ScheduleRow fromRow = findRowForMember(schedule, initiator.getId())
                .orElseThrow(() -> new BadRequestException("У вас нет смен в этом графике"));
        ScheduleRow toRow = findRowForMember(schedule, Objects.requireNonNull(request.toMemberId()))
                .orElseThrow(() -> new BadRequestException("Сотрудник не найден в графике"));

        String value = findCellValue(fromRow, day)
                .orElseThrow(() -> new BadRequestException("У вас нет смены в выбранный день"));

        if (findCellValue(toRow, day).isPresent()) {
            throw new BadRequestException("У выбранного сотрудника уже есть смена в этот день");
        }

        ensureNoActiveRequest(scheduleId, initiator.getId(), day);

        ScheduleShiftRequest entity = ScheduleShiftRequest.builder()
                .schedule(schedule)
                .type(ScheduleShiftRequestType.REPLACEMENT)
                .dayFrom(day)
                .fromRow(fromRow)
                .toRow(toRow)
                .initiatorMemberId(initiator.getId())
                .fromMemberId(fromRow.getMemberId())
                .toMemberId(toRow.getMemberId())
                .reason(request.reason())
                .status(ScheduleShiftRequestStatus.PENDING_MANAGER)
                .build();

        ScheduleShiftRequest saved = requests.save(entity);
        return toDto(saved);
    }

    @Override
    public ShiftRequestDto createSwap(Long restaurantId, Long scheduleId, Long userId, CreateSwapShiftRequest request) {
        RestaurantMember initiator = requireMember(userId, restaurantId);
        Schedule schedule = loadSchedule(scheduleId, restaurantId);

        LocalDate myDay = parseDate(request.myDay(), "myDay");
        LocalDate targetDay = parseDate(request.targetDay(), "targetDay");

        ScheduleRow fromRow = findRowForMember(schedule, initiator.getId())
                .orElseThrow(() -> new BadRequestException("У вас нет смен в этом графике"));
        ScheduleRow toRow = findRowForMember(schedule, Objects.requireNonNull(request.targetMemberId()))
                .orElseThrow(() -> new BadRequestException("Сотрудник не найден в графике"));

        String fromValue = findCellValue(fromRow, myDay)
                .orElseThrow(() -> new BadRequestException("У вас нет смены в выбранный день"));
        String targetValue = findCellValue(toRow, targetDay)
                .orElseThrow(() -> new BadRequestException("У выбранного сотрудника нет смены в эту дату"));

        if (findCellValue(fromRow, targetDay).isPresent()) {
            throw new BadRequestException("У вас уже есть смена в день коллеги");
        }
        if (findCellValue(toRow, myDay).isPresent()) {
            throw new BadRequestException("У коллеги уже есть смена в ваш день");
        }

        ensureNoActiveRequest(scheduleId, initiator.getId(), myDay);

        ScheduleShiftRequest entity = ScheduleShiftRequest.builder()
                .schedule(schedule)
                .type(ScheduleShiftRequestType.SWAP)
                .dayFrom(myDay)
                .dayTo(targetDay)
                .fromRow(fromRow)
                .toRow(toRow)
                .initiatorMemberId(initiator.getId())
                .fromMemberId(fromRow.getMemberId())
                .toMemberId(toRow.getMemberId())
                .reason(request.reason())
                .status(ScheduleShiftRequestStatus.PENDING_MANAGER)
                .build();

        ScheduleShiftRequest saved = requests.save(entity);
        return toDto(saved);
    }

    @Override
    public ShiftRequestDto decideAsManager(Long restaurantId, Long requestId, Long userId, boolean accepted) {
        securityService.assertAtLeastManager(userId, restaurantId);

        ScheduleShiftRequest entity = loadRequest(requestId, restaurantId);
        if (entity.getStatus() != ScheduleShiftRequestStatus.PENDING_MANAGER) {
            throw new BadRequestException("Заявка не требует решения менеджера");
        }

        if (!accepted) {
            entity.setStatus(ScheduleShiftRequestStatus.REJECTED_BY_MANAGER);
            return toDto(entity);
        }

        Schedule schedule = loadSchedule(entity.getSchedule().getId(), restaurantId);
        ScheduleRow fromRow = requireRow(schedule, entity.getFromRow().getId());
        ScheduleRow toRow = requireRow(schedule, entity.getToRow().getId());

        LocalDate dayFrom = entity.getDayFrom();
        LocalDate dayTo = entity.getDayTo();
        String fromShiftValue = findCellValue(fromRow, dayFrom).orElse(null);
        String toShiftValue = dayTo != null ? findCellValue(toRow, dayTo).orElse(null) : null;

        if (entity.getType() == ScheduleShiftRequestType.REPLACEMENT) {
            transferShift(fromRow, toRow, dayFrom);
        } else {
            if (dayTo == null) {
                throw new BadRequestException("Не указана дата обмена");
            }
            swapShifts(fromRow, toRow, dayFrom, dayTo);
        }

        entity.setStatus(ScheduleShiftRequestStatus.APPROVED);
        notifyParticipantsOnApproval(entity, fromShiftValue, toShiftValue);
        return toDto(entity);
    }

    @Override
    @Transactional(readOnly = true)
    public List<ShiftRequestDto> listForSchedule(Long restaurantId, Long scheduleId, Long userId) {
        RestaurantMember member = requireMember(userId, restaurantId);
        Schedule schedule = loadSchedule(scheduleId, restaurantId);
        List<ShiftRequestDto> all = requests.findByScheduleIdOrderByCreatedAtDesc(schedule.getId())
                .stream()
                .map(this::toDto)
                .toList();

        if (member.getRole() == RestaurantRole.STAFF) {
            return all.stream()
                    .filter(item ->
                            Objects.equals(item.fromMember().id(), member.getId()) ||
                                    Objects.equals(item.toMember().id(), member.getId()))
                    .toList();
        }

        return all;
    }

    private ScheduleShiftRequest loadRequest(Long requestId, Long restaurantId) {
        return requests.findByIdAndScheduleRestaurantId(requestId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Запрос не найден"));
    }

    private Schedule loadSchedule(Long scheduleId, Long restaurantId) {
        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("График не найден"));
        schedule.getRows().forEach(row -> row.getCells().size());
        return schedule;
    }

    private RestaurantMember requireMember(Long userId, Long restaurantId) {
        return members.findByUserIdAndRestaurantId(userId, restaurantId)
                .orElseThrow(() -> new ForbiddenException("Нет доступа к ресторану"));
    }

    private void ensureNoActiveRequest(Long scheduleId, Long memberId, LocalDate day) {
        requests.findActiveByScheduleAndFromMemberAndDay(scheduleId, memberId, day, ACTIVE_STATUSES)
                .ifPresent(r -> {
                    throw new BadRequestException("У этой смены уже есть активная заявка");
                });
    }

    private void notifyParticipantsOnApproval(ScheduleShiftRequest request, String fromShiftValue, String toShiftValue) {
        RestaurantMember initiator = members.findById(request.getInitiatorMemberId()).orElse(null);
        RestaurantMember fromMember = members.findById(request.getFromMemberId()).orElse(null);
        RestaurantMember toMember = members.findById(request.getToMemberId()).orElse(null);

        if (fromMember == null || toMember == null) {
            return;
        }

        String content;
        if (request.getType() == ScheduleShiftRequestType.REPLACEMENT) {
            content = String.format(
                    "%s передал смену %s %s%s",
                    request.getFromRow().getDisplayName(),
                    request.getToRow().getDisplayName(),
                    request.getDayFrom(),
                    formatShiftValue(fromShiftValue)
            );
        } else {
            content = String.format(
                    "%s и %s обменялись сменами %s%s ↔ %s%s",
                    request.getFromRow().getDisplayName(),
                    request.getToRow().getDisplayName(),
                    request.getDayFrom(),
                    formatShiftValue(fromShiftValue),
                    request.getDayTo(),
                    formatShiftValue(toShiftValue)
            );
        }

        Notification notification = Notification.builder()
                .restaurant(request.getSchedule().getRestaurant())
                .creator(initiator != null ? initiator.getUser() : fromMember.getUser())
                .content(content)
                .expiresAt(Optional.ofNullable(request.getSchedule().getEndDate())
                        .orElse(request.getSchedule().getStartDate()))
                .members(new HashSet<>(Set.of(fromMember, toMember)))
                .build();

        notifications.save(notification);
    }

    private String formatShiftValue(String value) {
        if (value == null || value.isBlank()) {
            return "";
        }
        return " (" + value + ")";
    }

    private Optional<ScheduleRow> findRowForMember(Schedule schedule, Long memberId) {
        return schedule.getRows().stream()
                .filter(row -> Objects.equals(row.getMemberId(), memberId))
                .findFirst();
    }

    private ScheduleRow requireRow(Schedule schedule, Long rowId) {
        return schedule.getRows().stream()
                .filter(row -> Objects.equals(row.getId(), rowId))
                .findFirst()
                .orElseThrow(() -> new NotFoundException("Строка графика не найдена"));
    }

    private Optional<String> findCellValue(ScheduleRow row, LocalDate day) {
        return row.getCells().stream()
                .filter(cell -> day.equals(cell.getDay()))
                .map(ScheduleCell::getValue)
                .findFirst();
    }

    private void transferShift(ScheduleRow fromRow, ScheduleRow toRow, LocalDate day) {
        String value = removeCell(fromRow, day)
                .orElseThrow(() -> new BadRequestException("Смена отсутствует"));

        if (findCellValue(toRow, day).isPresent()) {
            throw new BadRequestException("Целевая строка уже содержит смену");
        }

        ScheduleCell newCell = ScheduleCell.builder()
                .row(toRow)
                .day(day)
                .value(value)
                .build();
        toRow.getCells().add(newCell);
    }

    private void swapShifts(ScheduleRow fromRow, ScheduleRow toRow, LocalDate dayFrom, LocalDate dayTo) {
        String fromValue = removeCell(fromRow, dayFrom)
                .orElseThrow(() -> new BadRequestException("Смена сотрудника не найдена"));
        String toValue = removeCell(toRow, dayTo)
                .orElseThrow(() -> new BadRequestException("Смена коллеги не найдена"));

        if (findCellValue(fromRow, dayTo).isPresent() || findCellValue(toRow, dayFrom).isPresent()) {
            throw new BadRequestException("Одна из дат уже занята");
        }

        fromRow.getCells().add(ScheduleCell.builder()
                .row(fromRow)
                .day(dayTo)
                .value(toValue)
                .build());
        toRow.getCells().add(ScheduleCell.builder()
                .row(toRow)
                .day(dayFrom)
                .value(fromValue)
                .build());
    }

    private Optional<String> removeCell(ScheduleRow row, LocalDate day) {
        List<ScheduleCell> cells = new ArrayList<>(row.getCells());
        Optional<ScheduleCell> target = cells.stream()
                .filter(cell -> day.equals(cell.getDay()))
                .findFirst();
        target.ifPresent(cell -> row.getCells().remove(cell));
        return target.map(ScheduleCell::getValue);
    }

    private LocalDate parseDate(String value, String field) {
        if (value == null || value.isBlank()) {
            throw new BadRequestException("Поле " + field + " обязательно");
        }
        try {
            return LocalDate.parse(value);
        } catch (Exception ex) {
            throw new BadRequestException("Некорректный формат даты для " + field);
        }
    }

    private ShiftRequestDto toDto(ScheduleShiftRequest request) {
        return new ShiftRequestDto(
                request.getId(),
                request.getType(),
                request.getDayFrom() != null ? request.getDayFrom().toString() : null,
                request.getDayTo() != null ? request.getDayTo().toString() : null,
                request.getStatus(),
                request.getReason(),
                request.getCreatedAt(),
                new ShiftRequestMemberDto(
                        request.getFromRow().getMemberId(),
                        request.getFromRow().getDisplayName(),
                        request.getFromRow().getPositionName()
                ),
                new ShiftRequestMemberDto(
                        request.getToRow().getMemberId(),
                        request.getToRow().getDisplayName(),
                        request.getToRow().getPositionName()
                )
        );
    }
}