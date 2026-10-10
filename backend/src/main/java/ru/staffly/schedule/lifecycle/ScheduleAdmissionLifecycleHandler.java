package ru.staffly.schedule.lifecycle;
import lombok.RequiredArgsConstructor;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.InvitationScheduleIntentRepository;
import ru.staffly.invite.service.InvitationImpactService;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import java.util.*;
import java.util.function.Function;
import java.util.stream.Collectors;

@Component
@RequiredArgsConstructor
public class ScheduleAdmissionLifecycleHandler implements AdmissionLifecycleHandler {
    private final InvitationScheduleIntentRepository intents;
    private final ScheduleRepository schedules;
    private final InvitationImpactService impact;
    private final SchedulePreferenceLifecycleService lifecycle;
    @Override public LifecycleModule module() { return LifecycleModule.SCHEDULE; }
    @Override public int getOrder() { return 100; }
    public static boolean mutating(InvitationScheduleIntentAction action) {
        return action == InvitationScheduleIntentAction.ADD_TO_COLLECTION
                || action == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                || action == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD
                || action == InvitationScheduleIntentAction.ADD_TO_DRAFT;
    }
    @Override public PreparedAdmission prepare(AdmissionApplyContext c) {
        var selected = intents.findByInvitationIdOrderByExpectedScheduleIdAsc(c.invitation().getId()).stream()
                .filter(i -> mutating(i.getSelectedAction())).toList();
        var ids = selected.stream().map(InvitationScheduleIntent::getExpectedScheduleId).distinct().sorted().toList();
        var locked = ids.isEmpty() ? List.<Schedule>of()
                : schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(c.restaurantId(), ids);
        var byId = locked.stream().collect(Collectors.toMap(Schedule::getId, Function.identity()));
        for (var intent : selected) {
            var schedule = byId.get(intent.getExpectedScheduleId());
            if (schedule == null || !SchedulePositionIds.ids(schedule).contains(c.position().getId())) {
                throw new AdmissionPlanInvalidException("SCHEDULE_UNAVAILABLE");
            }
            var current = impact.opportunity(schedule, c.position().getId(), c.operationNow());
            if (!current.allowedActions().contains(intent.getSelectedAction()) || !current.eligibilityProblems().isEmpty()) {
                throw new AdmissionPlanInvalidException("SCHEDULE_CHANGED");
            }
            var deadline = intent.getRequestedDeadline();
            if (intent.getSelectedAction() == InvitationScheduleIntentAction.ADD_TO_COLLECTION) {
                if (deadline != null && (!deadline.isAfter(c.operationNow())
                        || (schedule.getPreferenceDeadline() != null && deadline.isBefore(schedule.getPreferenceDeadline())))) {
                    throw new AdmissionPlanInvalidException("DEADLINE_CHANGED");
                }
                if (deadline == null && (schedule.getPreferenceDeadline() == null
                        || !schedule.getPreferenceDeadline().isAfter(c.operationNow()))) {
                    throw new AdmissionPlanInvalidException("COLLECTION_EXPIRED");
                }
            } else if (intent.getSelectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION
                    || intent.getSelectedAction() == InvitationScheduleIntentAction.ADD_AND_REOPEN_FOR_REBUILD) {
                if (deadline == null || !deadline.isAfter(c.operationNow())) {
                    throw new AdmissionPlanInvalidException("DEADLINE_EXPIRED");
                }
                if (schedule.getPreferenceDeadline() != null && deadline.isBefore(schedule.getPreferenceDeadline())) {
                    throw new AdmissionPlanInvalidException("DEADLINE_CHANGED");
                }
            }
        }
        return member -> {
            var effects = new ArrayList<AppliedInvitationScheduleEffect>();
            for (var intent : selected) {
                var schedule = byId.get(intent.getExpectedScheduleId());
                boolean created;
                switch (intent.getSelectedAction()) {
                    case ADD_TO_DRAFT -> created = lifecycle.addDraftParticipantWithLocksHeld(schedule, member);
                    case ADD_AND_REOPEN_COLLECTION, ADD_AND_REOPEN_FOR_REBUILD ->
                        created = lifecycle.reopenForAdmissionWithLocksHeld(schedule, member, intent.getRequestedDeadline(),
                                c.user().getId(), c.operationNow()).participantCreated();
                    case ADD_TO_COLLECTION -> {
                        if (intent.getRequestedDeadline() != null) schedule.setPreferenceDeadline(intent.getRequestedDeadline());
                        created = lifecycle.addParticipantWithLocksHeld(schedule, member, c.user().getId(), "Принятие приглашения", c.operationNow());
                    }
                    default -> throw new IllegalStateException("Unexpected admission action");
                }
                if (created) effects.add(new AppliedInvitationScheduleEffect(schedule.getId(), schedule.getTitle(),
                        schedule.getOwnerUser() == null ? null : schedule.getOwnerUser().getId()));
            }
            return new AdmissionModuleResult(c.operationId(), List.copyOf(effects), List.of());
        };
    }
}
