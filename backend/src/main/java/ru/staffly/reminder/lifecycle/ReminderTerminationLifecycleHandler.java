package ru.staffly.reminder.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;
import ru.staffly.reminder.repository.ReminderRepository;

@Component
@RequiredArgsConstructor
public class ReminderTerminationLifecycleHandler implements TerminationLifecycleHandler {
    private final ReminderRepository reminders;
    @Override public LifecycleModule module() { return LifecycleModule.REMINDER; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 500; }
    @Override public ReminderTerminationImpact preview(TerminationPreviewContext context) {
        return new ReminderTerminationImpact(reminders.countByTargetMemberId(context.target().getId()));
    }
    @Override public ReminderTerminationResult applyBeforeTermination(TerminationApplyContext context,
            TerminationModuleDecision decision) {
        return new ReminderTerminationResult(reminders.detachPersonalTarget(context.target().getId(), context.now()));
    }
}
