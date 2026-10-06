package ru.staffly.checklist.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.checklist.repository.ChecklistItemRepository;
import ru.staffly.member.lifecycle.*;
import ru.staffly.dictionary.model.Position;
import java.util.Objects;

@Component
@RequiredArgsConstructor
public class ChecklistPositionChangeLifecycleHandler implements PositionChangeLifecycleHandler {
    private final ChecklistItemRepository items;
    private final ru.staffly.checklist.repository.ChecklistRepository checklists;
    @Override public LifecycleModule module() { return LifecycleModule.CHECKLIST; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 400; }
    private boolean eligible(ru.staffly.checklist.model.ChecklistItem item, Position target) {
        return PositionChangeSupport.management(target) || item.getChecklist().getPositions().stream()
                .anyMatch(p -> Objects.equals(p.getId(), target.getId()));
    }
    @Override public Impact preview(PositionChangePreviewContext c) {
        return new Impact((int) items.findByReservedById(c.member().getId()).stream().filter(i -> !eligible(i, c.targetPosition())).count());
    }
    @Override public Result applyAfterPositionChange(PositionChangeApplyContext c, PositionChangeModuleDecision d, PositionChangeModulePreparation p) {
        // Match ordinary checklist writes: parent before item, ordered parent IDs.
        items.findReservedChecklistIds(c.member().getId()).stream().distinct().sorted()
                .forEach(id -> checklists.findDetailedByIdForUpdate(id).orElseThrow(PositionChangeSupport::stale));
        var reserved = items.findReservedForUpdate(c.member().getId());
        int released = 0;
        for (var item : reserved) if (!eligible(item, c.targetPosition())) {
            item.setReservedBy(null); item.setReservedAt(null); released++;
        }
        return new Result(released);
    }
    public record Impact(int reservationsToRelease) implements PositionChangeModuleImpact {
        public LifecycleModule module() { return LifecycleModule.CHECKLIST; }
    }
    public record Result(int releasedReservations) implements PositionChangeModuleResult {
        public LifecycleModule module() { return LifecycleModule.CHECKLIST; }
    }
}
