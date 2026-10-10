package ru.staffly.training.lifecycle;

import lombok.RequiredArgsConstructor;
import org.springframework.core.Ordered;
import org.springframework.stereotype.Component;
import ru.staffly.member.lifecycle.*;
import ru.staffly.training.service.CertificationAudienceSyncService;
import ru.staffly.training.service.TrainingExamOwnershipService;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan;
import ru.staffly.common.exception.ConflictException;
import java.util.*;
import java.util.stream.Collectors;

/** Certification is a peer lifecycle participant; it never depends on Schedule. */
@Component
@RequiredArgsConstructor
public class CertificationEmployeeLifecycleHandler
        implements TerminationLifecycleHandler, PositionChangeLifecycleHandler {
    private final CertificationAudienceSyncService audienceSync;
    private final TrainingExamOwnershipService ownership;
    private final RestaurantMemberRepository members;
    @Override public LifecycleModule module() { return LifecycleModule.CERTIFICATION; }
    @Override public int getOrder() { return Ordered.HIGHEST_PRECEDENCE + 200; }
    @Override public CertificationLifecycleImpact preview(TerminationPreviewContext context) {
        Long ownerUserId = context.target().getUser().getId();
        var exams = ownership.findOwnedCertificationForLifecycle(context.restaurantId(), ownerUserId);
        if (exams.isEmpty()) return new CertificationLifecycleImpact(module(), true, List.of());
        var impacts = exams.stream().map(exam -> new EmployeeRemovalImpactPlan.OwnershipResource(
                exam.getId(), exam.getTitle(), exam.getEditorRevision(), ownerUserId,
                ownership.lifecycleCandidates(exam, context.target().getId(), context.target().getPosition()).stream()
                        .map(PositionChangeSupport::candidate).toList())).toList();
        return new CertificationLifecycleImpact(module(), true, impacts);
    }
    @Override public CertificationPositionChangeImpact preview(PositionChangePreviewContext context) {
        var exams = ownership.findOwnedCertificationForLifecycle(context.restaurantId(), context.member().getUser().getId());
        var impacts = exams.stream().filter(e -> !ownership.canRetainOwnership(e, context.targetPosition()))
                .map(e -> new EmployeeRemovalImpactPlan.OwnershipResource(e.getId(), e.getTitle(), e.getEditorRevision(),
                        context.member().getUser().getId(), ownership.lifecycleCandidates(e, context.member().getId(), context.targetPosition()).stream()
                        .map(PositionChangeSupport::candidate).toList())).toList();
        return new CertificationPositionChangeImpact(true, impacts, exams.stream()
                .map(e -> new ru.staffly.member.dto.PositionChangeImpactPlan.OwnershipState(e.getId(), e.getEditorRevision(), e.getOwner().getId())).toList(),
                ownership.positionAudienceChanges(context.restaurantId(), context.currentPosition().getId(), context.targetPosition().getId()));
    }
    @Override public CertificationPositionChangePreparation applyBeforePositionChange(PositionChangeApplyContext c,
            PositionChangeModuleDecision raw) {
        if (!(raw instanceof CertificationPositionChangeDecision d)) throw PositionChangeSupport.stale();
        ownership.lockCertificationLifecycleResources(c.restaurantId(), c.member().getUser().getId());
        Long owner = c.member().getUser().getId();
        var owned = ownership.findOwnedCertificationForLifecycle(c.restaurantId(), owner);
        var state = owned.stream().map(e -> new ru.staffly.member.dto.PositionChangeImpactPlan.OwnershipState(
                e.getId(), e.getEditorRevision(), e.getOwner().getId())).collect(Collectors.toSet());
        if (d.expectedOwnershipState() == null || state.size() != d.expectedOwnershipState().size()
                || !state.equals(new HashSet<>(d.expectedOwnershipState()))) throw PositionChangeSupport.stale();
        var required = owned.stream()
                .filter(e -> !ownership.canRetainOwnership(e, c.targetPosition())).toList();
        var tokens = new TreeMap<Long, ru.staffly.member.dto.ApplyEmployeeRemovalRequest.OwnershipTransfer>();
        for (var t : d.transfers()) if (tokens.put(t.resourceId(), t) != null) throw PositionChangeSupport.stale();
        if (!tokens.keySet().equals(required.stream().map(e -> e.getId()).collect(Collectors.toSet()))) throw PositionChangeSupport.stale();
        for (var e : required) {
            var t = tokens.get(e.getId());
            if (!Objects.equals(t.expectedOwnerUserId(), owner) || t.expectedVersion() != e.getEditorRevision()
                    || ownership.lifecycleCandidates(e, c.member().getId(), c.targetPosition()).stream()
                    .noneMatch(m -> Objects.equals(m.getUser().getId(), t.newOwnerUserId()))) throw PositionChangeSupport.stale();
        }
        try {
            return new CertificationPositionChangePreparation(tokens.isEmpty() ? List.of() :
                    ownership.batchReassignForLifecycleWithLocksHeld(c.restaurantId(), owner,
                    tokens.values().stream().map(t -> Map.entry(t.resourceId(), t.newOwnerUserId())).toList(),
                    tokens.values().stream().collect(Collectors.toMap(t -> t.resourceId(), t -> t.expectedVersion()))));
        } catch (ru.staffly.common.exception.ConflictException ex) { throw PositionChangeSupport.stale(); }
    }
    @Override public CertificationTerminationResult applyBeforeTermination(TerminationApplyContext context,
            TerminationModuleDecision raw) {
        if (!(raw instanceof CertificationTerminationDecision decision)) throw stale();
        ownership.lockCertificationLifecycleResources(context.restaurantId(), context.target().getUser().getId());
        Long oldOwner = context.target().getUser().getId();
        var expected = ownership.findOwnedCertificationForLifecycle(context.restaurantId(), oldOwner);
        var expectedIds = expected.stream().map(e -> e.getId()).collect(Collectors.toSet());
        var providedIds = decision.ownershipTransfers().stream().map(t -> t.resourceId()).collect(Collectors.toSet());
        if (providedIds.size() != decision.ownershipTransfers().size() || !expectedIds.equals(providedIds)
                || decision.ownershipTransfers().stream().anyMatch(t -> !Objects.equals(t.expectedOwnerUserId(), oldOwner)
                || expected.stream().noneMatch(e -> e.getId().equals(t.resourceId()) && e.getEditorRevision() == t.expectedVersion()))) throw stale();
        var applied = providedIds.isEmpty() ? List.<ru.staffly.training.dto.AppliedCertificationOwnershipTransfer>of()
                : ownership.batchReassignForLifecycleWithLocksHeld(context.restaurantId(), oldOwner,
                decision.ownershipTransfers().stream().map(t -> Map.entry(t.resourceId(), t.newOwnerUserId())).toList(),
                decision.ownershipTransfers().stream().collect(Collectors.toMap(t -> t.resourceId(), t -> t.expectedVersion())));
        return new CertificationTerminationResult(false, applied);
    }
    @Override public CertificationTerminationResult applyAfterTermination(TerminationApplyContext context,
            TerminationModuleDecision decision, TerminationModuleResult beforeResult) {
        audienceSync.syncRestaurantAudience(context.restaurantId(), context.target().getUser().getId(), false);
        return new CertificationTerminationResult(true, beforeResult instanceof CertificationTerminationResult r ? r.ownershipTransfers() : List.of());
    }
    @Override public CertificationPositionChangeResult applyAfterPositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision, PositionChangeModulePreparation preparation) {
        return new CertificationPositionChangeResult(
                audienceSync.syncRestaurantAudience(context.restaurantId(), context.member().getUser().getId(), false),
                ((CertificationPositionChangePreparation) preparation).transfers());
    }
    private ConflictException stale() { return new ConflictException("EMPLOYEE_REMOVAL_PLAN_STALE",
            Map.of("code", "EMPLOYEE_REMOVAL_PLAN_STALE")); }
}
