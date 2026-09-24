package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.temporal.TemporalAccessor;
import java.util.*;

/** Builds the opaque, semantic identity of all inputs read by the auto-build planner/apply flow. */
@Service
@RequiredArgsConstructor
public class ScheduleAutoBuildFingerprintService {
    private final SchedulePreferenceSubmissionRepository submissions;
    private final ScheduleParticipationRepository participations;

    public String fingerprint(Long restaurantId, Schedule schedule, ScheduleBuildTemplate template) {
        initialize(template);
        Canonical out = new Canonical();
        out.add("schedule", schedule.getId(), schedule.getVersion(), schedule.getStartDate(), schedule.getEndDate(),
                schedule.getShiftMode() == null ? null : schedule.getShiftMode().name(),
                schedule.getStatus() == null ? null : schedule.getStatus().name());

        List<Long> schedulePositionIds = SchedulePositionIds.ids(schedule).stream().sorted().toList();
        out.list("schedulePositions", schedulePositionIds);
        // Apply can only materialize assignments into existing historical rows. Cell contents are deliberately
        // excluded: the auto-build flow clears the affected period before applying the plan.
        Hibernate.initialize(schedule.getRows());
        out.list("rowMembers", schedule.getRows().stream().map(ScheduleRow::getMemberId)
                .filter(Objects::nonNull).sorted().toList());
        Set<Long> scheduled = new HashSet<>(schedulePositionIds);

        out.add("template", template.getId());
        List<ScheduleBuildPositionConfig> configs = template.getPositionConfigs().stream()
                .filter(config -> configPositionIds(config).stream().anyMatch(scheduled::contains))
                .sorted(Comparator.comparing(this::configKey))
                .toList();
        for (ScheduleBuildPositionConfig config : configs) {
            out.add("config", config.getTargetPattern() == null ? null : config.getTargetPattern().name(),
                    config.getMinRestHours(), config.getMinRestMode() == null ? null : config.getMinRestMode().name(),
                    config.getMaxShiftsPerPeriod(), config.getSortOrder());
            out.list("configPositions", configPositionIds(config));
            out.list("heavyDays", config.getHeavyDaysOfWeek().stream().sorted().toList());
            config.getWeekdayRegimes().stream().sorted(Comparator.comparing(this::regimeKey)).forEach(regime -> {
                out.add("regime", regimeKey(regime));
            });
        }

        List<Long> relevantPositionIds = configs.stream().flatMap(config -> configPositionIds(config).stream())
                .filter(scheduled::contains).distinct().sorted().toList();
        Set<Long> relevantPositions = new HashSet<>(relevantPositionIds);
        List<ScheduleParticipation> candidates = relevantPositionIds.isEmpty() ? List.of()
                : participations.findByScheduleIdOrderById(schedule.getId()).stream()
                .filter(participation -> relevantPositions.contains(participation.getPositionId()))
                .filter(participation -> participation.getMember().getUser() != null)
                .sorted(Comparator.comparing(participation -> participation.getMember().getId()))
                .toList();
        Set<Long> candidateIds = new HashSet<>();
        for (ScheduleParticipation candidate : candidates) {
            candidateIds.add(candidate.getMember().getId());
            out.add("candidate", candidate.getMember().getId(), candidate.getPositionId());
        }

        submissions.findWithCellsByScheduleId(schedule.getId()).stream()
                .filter(submission -> submission.getMember() != null && candidateIds.contains(submission.getMember().getId()))
                .sorted(Comparator.comparing(submission -> submission.getMember().getId()))
                .forEach(submission -> {
                    out.add("submission", submission.getMember().getId(), submission.getRevision());
                    submission.getCells().stream().sorted(Comparator.comparing(this::preferenceCellKey))
                            .forEach(cell -> out.add("preference", cell.getDay(),
                                    cell.getType() == null ? null : cell.getType().name(), cell.isFullDay(),
                                    cell.getStartTime(), cell.getEndTime()));
                });
        return sha256(out.value());
    }

    private void initialize(ScheduleBuildTemplate template) {
        Hibernate.initialize(template.getPositionConfigs());
        for (ScheduleBuildPositionConfig config : template.getPositionConfigs()) {
            Hibernate.initialize(config.getPositions());
            Hibernate.initialize(config.getHeavyDaysOfWeek());
            Hibernate.initialize(config.getWeekdayRegimes());
            for (ScheduleBuildWeekdayRegime regime : config.getWeekdayRegimes()) {
                Hibernate.initialize(regime.getDaysOfWeek()); Hibernate.initialize(regime.getShiftOptions());
                Hibernate.initialize(regime.getCoverageRules()); Hibernate.initialize(regime.getCoverageDateOverrides());
                regime.getCoverageDateOverrides().forEach(override -> Hibernate.initialize(override.getShiftOption()));
            }
        }
    }

    private List<Long> configPositionIds(ScheduleBuildPositionConfig config) {
        return config.getPositions().stream().map(position -> position.getId()).filter(Objects::nonNull).sorted().toList();
    }

    private String coverageKey(ScheduleBuildCoverageRule rule) {
        return key(rule.getDayOfWeek(), rule.getStartTime(), rule.getEndTime(), rule.getRequiredCount(), rule.getSortOrder());
    }

    private String overrideKey(ScheduleBuildCoverageDateOverride override) {
        ScheduleBuildShiftOption option = override.getShiftOption();
        return key(override.getDate(), option == null ? null : option.getStartTime(),
                option == null ? null : option.getEndTime(), option == null ? null : option.getSortOrder(),
                override.getRequiredCount());
    }

    private String preferenceCellKey(SchedulePreferenceCell cell) {
        return key(cell.getDay(), cell.getType() == null ? null : cell.getType().name(), cell.isFullDay(),
                cell.getStartTime(), cell.getEndTime());
    }

    /** Persistence IDs and regime insertion order are deliberately absent. */
    private String configKey(ScheduleBuildPositionConfig config) {
        Canonical canonical = new Canonical();
        canonical.add("config", config.getTargetPattern(), config.getMinRestHours(), config.getMinRestMode(),
                config.getMaxShiftsPerPeriod(), config.getSortOrder());
        canonical.list("positions", configPositionIds(config));
        canonical.list("heavyDays", config.getHeavyDaysOfWeek().stream().sorted().toList());
        canonical.list("regimes", config.getWeekdayRegimes().stream().map(this::regimeKey).sorted().toList());
        return canonical.value();
    }

    private String regimeKey(ScheduleBuildWeekdayRegime regime) {
        Canonical canonical = new Canonical();
        canonical.list("days", regime.getDaysOfWeek().stream().map(Enum::name).sorted().toList());
        canonical.add("period", regime.getWorkPeriodStart(), regime.getWorkPeriodEnd());
        canonical.list("shifts", regime.getShiftOptions().stream().map(this::shiftKey).sorted().toList());
        canonical.list("coverage", regime.getCoverageRules().stream().map(this::coverageKey).sorted().toList());
        canonical.list("overrides", regime.getCoverageDateOverrides().stream().map(this::overrideKey).sorted().toList());
        return canonical.value();
    }

    private String shiftKey(ScheduleBuildShiftOption option) {
        return key(option.getStartTime(), option.getEndTime(), option.getSortOrder());
    }

    private String key(Object... values) {
        Canonical canonical = new Canonical();
        canonical.add("key", values);
        return canonical.value();
    }

    private String sha256(String value) {
        try {
            return HexFormat.of().formatHex(MessageDigest.getInstance("SHA-256")
                    .digest(value.getBytes(StandardCharsets.UTF_8)));
        } catch (NoSuchAlgorithmException e) {
            throw new IllegalStateException("SHA-256 is unavailable", e);
        }
    }

    private static final class Canonical {
        private final StringBuilder value = new StringBuilder();

        void add(String section, Object... fields) {
            field(section);
            for (Object field : fields) field(field);
        }

        void list(String section, Collection<?> fields) {
            add(section, fields.size());
            fields.forEach(this::field);
        }

        private void field(Object field) {
            String text = field == null ? "<null>" : field instanceof Enum<?> item ? item.name()
                    : field instanceof TemporalAccessor ? field.toString() : String.valueOf(field);
            value.append(text.length()).append(':').append(text).append('|');
        }

        String value() { return value.toString(); }
    }
}
