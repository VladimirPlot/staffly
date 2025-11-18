package ru.staffly.income.service;

import jakarta.transaction.Transactional;
import lombok.RequiredArgsConstructor;
import org.springframework.http.HttpStatus;
import org.springframework.stereotype.Service;
import org.springframework.web.server.ResponseStatusException;
import ru.staffly.income.dto.*;
import ru.staffly.income.model.IncomePeriod;
import ru.staffly.income.model.IncomeShift;
import ru.staffly.income.model.IncomeShiftType;
import ru.staffly.income.repository.IncomePeriodRepository;
import ru.staffly.income.repository.IncomeShiftRepository;

import java.math.BigDecimal;
import java.math.RoundingMode;
import java.time.Duration;
import java.time.LocalTime;
import java.util.List;

@Service
@RequiredArgsConstructor
public class IncomeService {

    private static final BigDecimal ZERO = BigDecimal.ZERO.setScale(2);

    private final IncomePeriodRepository periods;
    private final IncomeShiftRepository shifts;

    public List<IncomePeriodSummaryDto> listPeriods(Long userId) {
        return periods.findByUserIdOrderByCreatedAtDesc(userId)
                .stream()
                .map(p -> toSummary(p, loadShifts(p.getId(), userId)))
                .toList();
    }

    public IncomePeriodSummaryDto createPeriod(Long userId, SaveIncomePeriodRequest request) {
        IncomePeriod period = IncomePeriod.builder()
                .userId(userId)
                .name(request.name())
                .description(request.description())
                .build();
        IncomePeriod saved = periods.save(period);
        return toSummary(saved, List.of());
    }

    public IncomePeriodSummaryDto updatePeriod(Long userId, Long periodId, SaveIncomePeriodRequest request) {
        IncomePeriod period = periods.findByIdAndUserId(periodId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Период не найден"));
        period.setName(request.name());
        period.setDescription(request.description());
        IncomePeriod saved = periods.save(period);
        return toSummary(saved, loadShifts(saved.getId(), userId));
    }

    @Transactional
    public void deletePeriod(Long userId, Long periodId) {
        IncomePeriod period = periods.findByIdAndUserId(periodId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Период не найден"));
        shifts.findByPeriodIdAndUserIdOrderByDateDesc(periodId, userId)
                .forEach(shifts::delete);
        periods.delete(period);
    }

    public IncomePeriodDetailDto getPeriod(Long userId, Long periodId) {
        IncomePeriod period = periods.findByIdAndUserId(periodId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Период не найден"));
        List<IncomeShift> periodShifts = loadShifts(periodId, userId);
        return new IncomePeriodDetailDto(toSummary(period, periodShifts), periodShifts.stream().map(this::toDto).toList());
    }

    public IncomeShiftDto createShift(Long userId, Long periodId, SaveIncomeShiftRequest request) {
        IncomePeriod period = periods.findByIdAndUserId(periodId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Период не найден"));
        IncomeShift shift = buildShift(period, userId, request);
        return toDto(shifts.save(shift));
    }

    public IncomeShiftDto updateShift(Long userId, Long shiftId, SaveIncomeShiftRequest request) {
        IncomeShift shift = shifts.findByIdAndUserId(shiftId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Смена не найдена"));
        applyShiftUpdate(shift, request);
        return toDto(shifts.save(shift));
    }

    public void deleteShift(Long userId, Long shiftId) {
        IncomeShift shift = shifts.findByIdAndUserId(shiftId, userId)
                .orElseThrow(() -> new ResponseStatusException(HttpStatus.NOT_FOUND, "Смена не найдена"));
        shifts.delete(shift);
    }

    private List<IncomeShift> loadShifts(Long periodId, Long userId) {
        return shifts.findByPeriodIdAndUserIdOrderByDateDesc(periodId, userId);
    }

    private IncomeShift buildShift(IncomePeriod period, Long userId, SaveIncomeShiftRequest request) {
        IncomeShift shift = IncomeShift.builder()
                .period(period)
                .userId(userId)
                .date(request.date())
                .type(request.type())
                .tipsAmount(safeValue(request.tipsAmount()))
                .personalRevenue(safeValue(request.personalRevenue()))
                .comment(request.comment())
                .build();
        applyShiftUpdate(shift, request);
        return shift;
    }

    private void applyShiftUpdate(IncomeShift shift, SaveIncomeShiftRequest request) {
        if (request.type() == IncomeShiftType.SHIFT) {
            if (request.fixedAmount() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Оплата за смену обязательна для фиксированного типа");
            }
            shift.setType(IncomeShiftType.SHIFT);
            shift.setFixedAmount(request.fixedAmount());
            shift.setStartTime(null);
            shift.setEndTime(null);
            shift.setHourlyRate(null);
        } else if (request.type() == IncomeShiftType.HOURLY) {
            LocalTime start = request.startTime();
            LocalTime end = request.endTime();
            if (start == null || end == null || !end.isAfter(start)) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Время начала/окончания заполнено некорректно");
            }
            if (request.hourlyRate() == null) {
                throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Ставка обязательна для почасового типа");
            }
            shift.setType(IncomeShiftType.HOURLY);
            shift.setStartTime(start);
            shift.setEndTime(end);
            shift.setHourlyRate(request.hourlyRate());
            shift.setFixedAmount(null);
        } else {
            throw new ResponseStatusException(HttpStatus.BAD_REQUEST, "Неизвестный тип смены");
        }

        shift.setDate(request.date());
        shift.setTipsAmount(safeValue(request.tipsAmount()));
        shift.setPersonalRevenue(safeValue(request.personalRevenue()));
        shift.setComment(request.comment());
    }

    private IncomePeriodSummaryDto toSummary(IncomePeriod period, List<IncomeShift> shiftList) {
        SummaryAccumulator acc = new SummaryAccumulator();
        shiftList.forEach(acc::apply);
        return new IncomePeriodSummaryDto(
                period.getId(),
                period.getName(),
                period.getDescription(),
                shiftList.size(),
                acc.totalHours,
                acc.totalIncome,
                acc.totalTips,
                acc.totalPersonalRevenue,
                period.getCreatedAt(),
                period.getUpdatedAt()
        );
    }

    private IncomeShiftDto toDto(IncomeShift shift) {
        BigDecimal hours = calculateHours(shift);
        BigDecimal baseIncome = calculateBaseIncome(shift, hours);
        BigDecimal totalIncome = baseIncome.add(safeValue(shift.getTipsAmount()));
        return new IncomeShiftDto(
                shift.getId(),
                shift.getDate(),
                shift.getType(),
                shift.getFixedAmount(),
                shift.getStartTime(),
                shift.getEndTime(),
                shift.getHourlyRate(),
                shift.getTipsAmount(),
                shift.getPersonalRevenue(),
                shift.getComment(),
                hours,
                totalIncome,
                shift.getCreatedAt(),
                shift.getUpdatedAt()
        );
    }

    private BigDecimal calculateHours(IncomeShift shift) {
        if (shift.getType() != IncomeShiftType.HOURLY || shift.getStartTime() == null || shift.getEndTime() == null) {
            return ZERO;
        }
        Duration duration = Duration.between(shift.getStartTime(), shift.getEndTime());
        BigDecimal minutes = BigDecimal.valueOf(duration.toMinutes());
        return minutes.divide(BigDecimal.valueOf(60), 2, RoundingMode.HALF_UP);
    }

    private BigDecimal calculateBaseIncome(IncomeShift shift, BigDecimal hours) {
        if (shift.getType() == IncomeShiftType.SHIFT) {
            return safeValue(shift.getFixedAmount());
        }
        if (shift.getHourlyRate() == null) {
            return ZERO;
        }
        return hours.multiply(shift.getHourlyRate()).setScale(2, RoundingMode.HALF_UP);
    }

    private BigDecimal safeValue(BigDecimal value) {
        return value == null ? ZERO : value.setScale(2, RoundingMode.HALF_UP);
    }

    private class SummaryAccumulator {
        private BigDecimal totalHours = ZERO;
        private BigDecimal totalIncome = ZERO;
        private BigDecimal totalTips = ZERO;
        private BigDecimal totalPersonalRevenue = ZERO;

        void apply(IncomeShift shift) {
            BigDecimal hours = calculateHours(shift);
            BigDecimal baseIncome = calculateBaseIncome(shift, hours);
            totalHours = totalHours.add(hours);
            totalTips = totalTips.add(safeValue(shift.getTipsAmount()));
            totalPersonalRevenue = totalPersonalRevenue.add(safeValue(shift.getPersonalRevenue()));
            totalIncome = totalIncome.add(baseIncome).add(safeValue(shift.getTipsAmount()));
        }
    }
}