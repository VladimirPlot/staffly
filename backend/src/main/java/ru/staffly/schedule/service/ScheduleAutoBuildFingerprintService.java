package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.hibernate.Hibernate;
import org.springframework.stereotype.Service;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;

import java.nio.charset.StandardCharsets;
import java.security.MessageDigest;
import java.security.NoSuchAlgorithmException;
import java.time.temporal.TemporalAccessor;
import java.util.*;

/** Builds the opaque, semantic identity of all inputs read by the auto-build planner/apply flow. */
@Service
@RequiredArgsConstructor
public class ScheduleAutoBuildFingerprintService {
    private final RestaurantMemberRepository members;
    private final SchedulePreferenceSubmissionRepository submissions;

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
                .sorted(Comparator.comparing(ScheduleBuildPositionConfig::getId, Comparator.nullsFirst(Long::compareTo)))
                .toList();
        for (ScheduleBuildPositionConfig config : configs) {
            out.add("config", config.getId(), config.getFullShiftStart(), config.getFullShiftEnd(),
                    config.getTargetPattern() == null ? null : config.getTargetPattern().name(),
                    config.getMinRestHours(), config.getMinRestMode() == null ? null : config.getMinRestMode().name(),
                    config.getMaxShiftsPerPeriod(), config.getSortOrder());
            out.list("configPositions", configPositionIds(config));
            out.list("heavyDays", config.getHeavyDaysOfWeek().stream().sorted().toList());

            config.getShiftOptions().stream()
                    .sorted(Comparator.comparing(ScheduleBuildShiftOption::getId, Comparator.nullsFirst(Long::compareTo)))
                    .forEach(option -> out.add("shift", option.getId(), option.getStartTime(), option.getEndTime(),
                            option.isFullShift(), option.getSortOrder()));
            config.getCoverageRules().stream()
                    .sorted(Comparator.comparing(this::coverageKey))
                    .forEach(rule -> out.add("coverage", rule.getDayOfWeek(), rule.getStartTime(), rule.getEndTime(),
                            rule.getRequiredCount(), rule.getSortOrder()));
            config.getCoverageDateOverrides().stream()
                    .sorted(Comparator.comparing(this::overrideKey))
                    .forEach(override -> {
                        ScheduleBuildShiftOption option = override.getShiftOption();
                        out.add("override", override.getDate(), option == null ? null : option.getId(),
                                option == null ? null : option.getStartTime(), option == null ? null : option.getEndTime(),
                                option != null && option.isFullShift(), override.getRequiredCount());
                    });
        }

        List<Long> relevantPositionIds = configs.stream().flatMap(config -> configPositionIds(config).stream())
                .filter(scheduled::contains).distinct().sorted().toList();
        List<RestaurantMember> candidates = relevantPositionIds.isEmpty() ? List.of()
                : members.findWithUserAndPositionByRestaurantIdAndPositionIdIn(restaurantId, relevantPositionIds).stream()
                .filter(member -> member.getUser() != null)
                .sorted(Comparator.comparing(RestaurantMember::getId))
                .toList();
        Set<Long> candidateIds = new HashSet<>();
        for (RestaurantMember candidate : candidates) {
            candidateIds.add(candidate.getId());
            out.add("candidate", candidate.getId(), candidate.getPosition().getId());
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
            Hibernate.initialize(config.getShiftOptions());
            Hibernate.initialize(config.getCoverageRules());
            Hibernate.initialize(config.getCoverageDateOverrides());
            config.getCoverageDateOverrides().forEach(override -> Hibernate.initialize(override.getShiftOption()));
        }
    }

    private List<Long> configPositionIds(ScheduleBuildPositionConfig config) {
        return config.getPositions().stream().map(position -> position.getId()).filter(Objects::nonNull).sorted().toList();
    }

    private String coverageKey(ScheduleBuildCoverageRule rule) {
        return key(rule.getDayOfWeek(), rule.getStartTime(), rule.getEndTime(), rule.getRequiredCount(), rule.getSortOrder(), rule.getId());
    }

    private String overrideKey(ScheduleBuildCoverageDateOverride override) {
        return key(override.getDate(), override.getShiftOption() == null ? null : override.getShiftOption().getId(),
                override.getRequiredCount(), override.getId());
    }

    private String preferenceCellKey(SchedulePreferenceCell cell) {
        return key(cell.getDay(), cell.getType() == null ? null : cell.getType().name(), cell.isFullDay(),
                cell.getStartTime(), cell.getEndTime(), cell.getId());
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
