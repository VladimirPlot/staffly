package ru.staffly.schedule.service;

import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Service;
import org.springframework.transaction.annotation.Transactional;
import ru.staffly.schedule.dto.SaveScheduleBuildTemplateRequest;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleRepository;

import java.util.List;

/** Builds a factual impact read model without applying either template or schedule mutations. */
@Service
@RequiredArgsConstructor
public class ScheduleBuildTemplateImpactPlanner {
    private final ScheduleBuildTemplateChangeClassifier classifier;
    private final ScheduleRepository schedules;

    @Transactional(readOnly = true)
    public ScheduleBuildTemplateImpactPlan plan(
            Long restaurantId,
            ScheduleBuildTemplate current,
            SaveScheduleBuildTemplateRequest proposed
    ) {
        return plan(current, proposed, schedules
                .findByRestaurantIdAndPreferenceBuildTemplateIdOrderByIdAsc(restaurantId, current.getId()));
    }

    /** Pure planning path for callers that already hold locks on the authoritative schedules. */
    public ScheduleBuildTemplateImpactPlan plan(
            ScheduleBuildTemplate current,
            SaveScheduleBuildTemplateRequest proposed,
            List<Schedule> lockedSchedules
    ) {
        ScheduleBuildTemplateChangeImpact impact = classifier.classify(current, proposed);
        List<ScheduleBuildTemplateScheduleImpact> scheduleImpacts = lockedSchedules.stream()
                .map(schedule -> toImpact(schedule, impact))
                .toList();
        return new ScheduleBuildTemplateImpactPlan(impact, scheduleImpacts);
    }

    private ScheduleBuildTemplateScheduleImpact toImpact(
            Schedule schedule,
            ScheduleBuildTemplateChangeImpact impact
    ) {
        return new ScheduleBuildTemplateScheduleImpact(
                schedule.getId(), schedule.getTitle(), schedule.getStatus(), actionFor(schedule.getStatus(), impact));
    }

    private ScheduleBuildTemplateScheduleAction actionFor(
            ScheduleStatus status,
            ScheduleBuildTemplateChangeImpact impact
    ) {
        if (impact == ScheduleBuildTemplateChangeImpact.NONE
                || impact == ScheduleBuildTemplateChangeImpact.NEUTRAL_METADATA) {
            return ScheduleBuildTemplateScheduleAction.NO_ACTION;
        }
        if (status == ScheduleStatus.PUBLISHED) {
            return ScheduleBuildTemplateScheduleAction.PUBLISHED_UNCHANGED;
        }
        if (status == ScheduleStatus.DRAFT) {
            return ScheduleBuildTemplateScheduleAction.NO_ACTION;
        }
        if (impact == ScheduleBuildTemplateChangeImpact.PREFERENCE_AFFECTING) {
            return ScheduleBuildTemplateScheduleAction.RESET_PREFERENCE_COLLECTION;
        }
        return status == ScheduleStatus.DRAFT_FROM_PREFERENCES
                ? ScheduleBuildTemplateScheduleAction.INVALIDATE_APPLIED_AUTO_BUILD
                : ScheduleBuildTemplateScheduleAction.KEEP_PREFERENCES;
    }
}
