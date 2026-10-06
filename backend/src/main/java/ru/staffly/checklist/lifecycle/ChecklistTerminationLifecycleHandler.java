package ru.staffly.checklist.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.checklist.repository.ChecklistItemRepository;
import ru.staffly.member.lifecycle.*;

@Component
@RequiredArgsConstructor
public class ChecklistTerminationLifecycleHandler implements TerminationLifecycleHandler {
    private final ChecklistItemRepository items;
    private final ru.staffly.checklist.repository.ChecklistRepository checklists;
    @Override public LifecycleModule module() { return LifecycleModule.CHECKLIST; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 400; }
    @Override public ChecklistTerminationImpact preview(TerminationPreviewContext context) {
        return new ChecklistTerminationImpact(items.countActiveReservationsForMember(context.target().getId()));
    }
    @Override public ChecklistTerminationResult applyBeforeTermination(TerminationApplyContext context,
            TerminationModuleDecision decision) {
        // Match ordinary edits: parent before item; stale edit flushes must not restore cleared reservations.
        items.findReservedChecklistIds(context.target().getId()).stream().distinct().sorted()
                .forEach(id -> checklists.findDetailedByIdForUpdate(id).orElseThrow());
        return new ChecklistTerminationResult(items.releaseActiveReservationsForMember(context.target().getId()));
    }
}
