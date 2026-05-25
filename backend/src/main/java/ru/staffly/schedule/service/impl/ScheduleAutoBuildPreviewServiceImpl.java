package ru.staffly.schedule.service.impl;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.common.exception.NotFoundException;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAutoBuildPreviewService;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.time.LocalTime;
import java.time.format.DateTimeFormatter;
import java.util.*;
import java.util.stream.Collectors;

@Service
@RequiredArgsConstructor
@Transactional(readOnly = true)
public class ScheduleAutoBuildPreviewServiceImpl implements ScheduleAutoBuildPreviewService {
    private static final int END_OF_DAY_MINUTES = 24 * 60;
    private static final DateTimeFormatter HH_MM = DateTimeFormatter.ofPattern("HH:mm");

    private final SecurityService securityService;
    private final ScheduleAccessService scheduleAccessService;
    private final ScheduleRepository schedules;
    private final ScheduleBuildTemplateRepository templates;
    private final RestaurantMemberRepository members;
    private final SchedulePreferenceSubmissionRepository submissions;

    @Override
    public ScheduleAutoBuildPreviewResponse preview(Long restaurantId, Long scheduleId, Long actorUserId, PreviewScheduleAutoBuildRequest request) {
        securityService.assertRestaurantUnlocked(actorUserId, restaurantId);
        scheduleAccessService.assertCanManageSchedules(actorUserId, restaurantId);

        Schedule schedule = schedules.findByIdAndRestaurantId(scheduleId, restaurantId)
                .orElseThrow(() -> new NotFoundException("Schedule not found: " + scheduleId));
        if (schedule.getStatus() != ScheduleStatus.PREFERENCES_CLOSED && schedule.getStatus() != ScheduleStatus.DRAFT_FROM_PREFERENCES) {
            throw new BadRequestException("Preview автосборки доступен только для статусов PREFERENCES_CLOSED или DRAFT_FROM_PREFERENCES");
        }

        ScheduleBuildTemplate template = templates.findDetailedByIdAndRestaurantIdAndIsActiveTrue(request.templateId(), restaurantId)
                .orElseThrow(() -> new NotFoundException("Active template not found: " + request.templateId()));

        List<String> topWarnings = new ArrayList<>();
        List<Long> schedulePositions = schedule.getPositionIds() == null ? List.of() : schedule.getPositionIds();
        Set<Long> templatePositionIds = template.getPositionConfigs().stream().map(pc -> pc.getPosition().getId()).collect(Collectors.toSet());
        if (Collections.disjoint(templatePositionIds, schedulePositions)) {
            throw new BadRequestException("Шаблон не содержит конфигураций для позиций графика");
        }

        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            if (!schedulePositions.contains(config.getPosition().getId())) {
                topWarnings.add("В шаблоне есть позиция вне графика: " + config.getPosition().getName());
            }
            if (config.getMinRestHours() != null || config.getMaxShiftsPerPeriod() != null) {
                topWarnings.add("Ограничения minRestHours/maxShiftsPerPeriod будут применены на следующем этапе");
            }
        }
        for (Long schedulePositionId : schedulePositions) {
            if (!templatePositionIds.contains(schedulePositionId)) {
                topWarnings.add("Для одной из позиций графика нет конфигурации в шаблоне (positionId=" + schedulePositionId + ")");
            }
        }

        Map<Long, List<SchedulePreferenceCell>> prefByMember = submissions.findWithCellsByScheduleId(scheduleId).stream()
                .collect(Collectors.toMap(s -> s.getMember().getId(), SchedulePreferenceSubmission::getCells));

        List<ScheduleAutoBuildPositionPreviewDto> positionDtos = new ArrayList<>();
        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            if (!schedulePositions.contains(config.getPosition().getId())) {
                continue;
            }
            positionDtos.add(buildPositionPreview(restaurantId, schedule, config, prefByMember));
        }

        return new ScheduleAutoBuildPreviewResponse(schedule.getId(), template.getId(), template.getName(), positionDtos, topWarnings.stream().distinct().toList());
    }

    private ScheduleAutoBuildPositionPreviewDto buildPositionPreview(Long restaurantId,
                                                                     Schedule schedule,
                                                                     ScheduleBuildPositionConfig config,
                                                                     Map<Long, List<SchedulePreferenceCell>> prefByMember) {
        List<RestaurantMember> candidates = members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(
                        restaurantId, List.of(config.getPosition().getId())).stream()
                .filter(m -> m.getUser() != null)
                .toList();

        List<String> warnings = new ArrayList<>();
        List<ScheduleAutoBuildCellPreviewDto> cells = new ArrayList<>();
        Map<LocalDate, Set<Long>> usedByDay = new HashMap<>();

        for (LocalDate day = schedule.getStartDate(); !day.isAfter(schedule.getEndDate()); day = day.plusDays(1)) {
            int dayOfWeek = day.getDayOfWeek().getValue();
            List<ScheduleBuildCoverageRule> rules = config.getCoverageRules().stream().filter(r -> r.getDayOfWeek() == dayOfWeek).toList();
            for (ScheduleBuildCoverageRule rule : rules) {
                ScheduleBuildShiftOption option = findShiftOption(config.getShiftOptions(), rule);
                if (option == null) {
                    warnings.add("Не найден shiftOption для правила " + rule.getStartTime() + "-" + rule.getEndTime());
                    continue;
                }
                for (int i = 0; i < Optional.ofNullable(rule.getRequiredCount()).orElse(0); i++) {
                    RestaurantMember selected = pickMember(candidates, prefByMember, day, option, usedByDay.computeIfAbsent(day, k -> new HashSet<>()));
                    if (selected == null) {
                        warnings.add("Недостаточно сотрудников для покрытия " + day + " " + formatShift(option));
                        continue;
                    }
                    List<String> cellWarnings = new ArrayList<>();
                    String reason = reasonFor(selected.getId(), prefByMember.getOrDefault(selected.getId(), List.of()), day, option, cellWarnings);
                    cells.add(new ScheduleAutoBuildCellPreviewDto(
                            selected.getId(),
                            displayName(selected),
                            day.toString(),
                            formatShift(option),
                            option.getId(),
                            option.getLabel(),
                            reason,
                            cellWarnings
                    ));
                    usedByDay.get(day).add(selected.getId());
                }
            }
        }
        return new ScheduleAutoBuildPositionPreviewDto(config.getPosition().getId(), config.getPosition().getName(), cells, warnings.stream().distinct().toList());
    }

    private RestaurantMember pickMember(List<RestaurantMember> candidates, Map<Long, List<SchedulePreferenceCell>> prefByMember,
                                        LocalDate day, ScheduleBuildShiftOption option, Set<Long> used) {
        List<RestaurantMember> positive = new ArrayList<>();
        List<RestaurantMember> noPref = new ArrayList<>();
        List<RestaurantMember> negative = new ArrayList<>();
        for (RestaurantMember m : candidates) {
            if (used.contains(m.getId())) continue;
            PreferenceGrade grade = grade(prefByMember.getOrDefault(m.getId(), List.of()), day, option);
            if (grade == PreferenceGrade.POSITIVE) positive.add(m);
            else if (grade == PreferenceGrade.NONE) noPref.add(m);
            else negative.add(m);
        }
        if (!positive.isEmpty()) return positive.get(0);
        if (!noPref.isEmpty()) return noPref.get(0);
        return negative.isEmpty() ? null : negative.get(0);
    }

    private String reasonFor(Long memberId, List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option, List<String> warnings) {
        PreferenceGrade grade = grade(cells, day, option);
        if (grade == PreferenceGrade.POSITIVE) {
            if (hasPartialOverlap(cells, day, option)) warnings.add("Пожелание частично пересекается со сменой");
            return "Подходит по пожеланию";
        }
        if (grade == PreferenceGrade.NEGATIVE) {
            warnings.add("Есть отрицательное пожелание на этот день");
            return "Поставлен для покрытия потребности";
        }
        return "Нет пожелания, выбран по доступности";
    }

    private boolean hasPartialOverlap(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option) {
        int shiftStart = toMinute(option.getStartTime(), false);
        int shiftEnd = toMinute(option.getEndTime(), true);
        return cells.stream().anyMatch(c -> c.getDay().equals(day) && !c.isFullDay() && c.getStartTime() != null && c.getEndTime() != null
                && overlaps(toMinute(c.getStartTime(), false), toMinute(c.getEndTime(), true), shiftStart, shiftEnd));
    }

    private PreferenceGrade grade(List<SchedulePreferenceCell> cells, LocalDate day, ScheduleBuildShiftOption option) {
        List<SchedulePreferenceCell> dayCells = cells.stream().filter(c -> c.getDay().equals(day)).toList();
        if (dayCells.isEmpty()) return PreferenceGrade.NONE;
        boolean positive = dayCells.stream().anyMatch(c -> isPositive(c, option));
        if (positive) return PreferenceGrade.POSITIVE;
        boolean negative = dayCells.stream().anyMatch(c -> c.getType() == SchedulePreferenceType.UNAVAILABLE || c.getType() == SchedulePreferenceType.PREFER_DAY_OFF);
        return negative ? PreferenceGrade.NEGATIVE : PreferenceGrade.NONE;
    }

    private boolean isPositive(SchedulePreferenceCell c, ScheduleBuildShiftOption option) {
        if (c.getType() != SchedulePreferenceType.AVAILABLE && c.getType() != SchedulePreferenceType.PREFER_WORK) return false;
        if (c.isFullDay()) return true;
        if (c.getStartTime() == null || c.getEndTime() == null) return false;
        return overlaps(toMinute(c.getStartTime(), false), toMinute(c.getEndTime(), true), toMinute(option.getStartTime(), false), toMinute(option.getEndTime(), true));
    }

    private ScheduleBuildShiftOption findShiftOption(List<ScheduleBuildShiftOption> options, ScheduleBuildCoverageRule rule) {
        for (ScheduleBuildShiftOption option : options) {
            if (option.getStartTime().equals(rule.getStartTime()) && option.getEndTime().equals(rule.getEndTime())) return option;
        }
        for (ScheduleBuildShiftOption option : options) {
            if (covers(toMinute(option.getStartTime(), false), toMinute(option.getEndTime(), true), toMinute(rule.getStartTime(), false), toMinute(rule.getEndTime(), true))) return option;
        }
        return null;
    }

    private String displayName(RestaurantMember m) {
        String first = m.getUser() == null ? "" : Optional.ofNullable(m.getUser().getFirstName()).orElse("");
        String last = m.getUser() == null ? "" : Optional.ofNullable(m.getUser().getLastName()).orElse("");
        return (first + " " + last).trim();
    }

    private String formatShift(ScheduleBuildShiftOption option) {
        return option.getStartTime().format(HH_MM) + "-" + option.getEndTime().format(HH_MM);
    }

    private int toMinute(LocalTime time, boolean endTime) {
        if (endTime && LocalTime.MIDNIGHT.equals(time)) return END_OF_DAY_MINUTES;
        return time.getHour() * 60 + time.getMinute();
    }

    private boolean overlaps(int startA, int endA, int startB, int endB) {
        return startA < endB && startB < endA;
    }

    private boolean covers(int shiftStart, int shiftEnd, int ruleStart, int ruleEnd) {
        return shiftStart <= ruleStart && shiftEnd >= ruleEnd;
    }

    private enum PreferenceGrade {POSITIVE, NONE, NEGATIVE}
}
