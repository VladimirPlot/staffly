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
        var exams = ownership.findActiveOwnedCertificationExams(context.restaurantId(), ownerUserId);
        if (exams.isEmpty()) return new CertificationLifecycleImpact(module(), true, List.of());
        var options = ownership.buildReassignmentOptions(context.restaurantId(), context.actorUserId(), ownerUserId);
        var memberByUser = members.findActiveWithUserAndPositionByRestaurantId(context.restaurantId()).stream()
                .collect(Collectors.toMap(m -> m.getUser().getId(), m -> m));
        var impacts = options.ownedExams().stream().map(exam -> new EmployeeRemovalImpactPlan.OwnershipResource(
                exam.examId(), exam.title(), exams.stream().filter(e -> e.getId().equals(exam.examId())).findFirst().orElseThrow().getEditorRevision(),
                ownerUserId, exam.candidates().stream().map(c -> {
                    var member = memberByUser.get(c.userId());
                    return new EmployeeRemovalImpactPlan.Candidate(member.getId(), c.userId(), c.fullName(), c.positionName());
                }).toList())).toList();
        return new CertificationLifecycleImpact(module(), true, impacts);
    }
    @Override public CertificationLifecycleImpact preview(PositionChangePreviewContext context) {
        return new CertificationLifecycleImpact(module(), true, List.of());
    }
    @Override public CertificationTerminationResult applyBeforeTermination(TerminationApplyContext context,
            TerminationModuleDecision raw) {
        if (!(raw instanceof CertificationTerminationDecision decision)) throw stale();
        Long oldOwner = context.target().getUser().getId();
        var expected = ownership.findActiveOwnedCertificationExams(context.restaurantId(), oldOwner);
        var expectedIds = expected.stream().map(e -> e.getId()).collect(Collectors.toSet());
        var providedIds = decision.ownershipTransfers().stream().map(t -> t.resourceId()).collect(Collectors.toSet());
        if (providedIds.size() != decision.ownershipTransfers().size() || !expectedIds.equals(providedIds)
                || decision.ownershipTransfers().stream().anyMatch(t -> !Objects.equals(t.expectedOwnerUserId(), oldOwner)
                || expected.stream().noneMatch(e -> e.getId().equals(t.resourceId()) && e.getEditorRevision() == t.expectedVersion()))) throw stale();
        var applied = providedIds.isEmpty() ? List.<ru.staffly.training.dto.AppliedCertificationOwnershipTransfer>of()
                : ownership.batchReassignValidated(context.restaurantId(), context.actorUserId(), oldOwner,
                decision.ownershipTransfers().stream().map(t -> Map.entry(t.resourceId(), t.newOwnerUserId())).toList(),
                decision.ownershipTransfers().stream().collect(Collectors.toMap(t -> t.resourceId(), t -> t.expectedVersion())));
        return new CertificationTerminationResult(false, applied);
    }
    @Override public CertificationTerminationResult applyAfterTermination(TerminationApplyContext context,
            TerminationModuleDecision decision, TerminationModuleResult beforeResult) {
        audienceSync.syncRestaurantAudience(context.restaurantId());
        return new CertificationTerminationResult(true, beforeResult instanceof CertificationTerminationResult r ? r.ownershipTransfers() : List.of());
    }
    @Override public CertificationPositionChangeResult applyAfterPositionChange(PositionChangeApplyContext context,
            PositionChangeModuleDecision decision, PositionChangeModulePreparation preparation) {
        return new CertificationPositionChangeResult(
                audienceSync.syncRestaurantAudience(context.restaurantId(), context.member().getUser().getId()));
    }
    private ConflictException stale() { return new ConflictException("EMPLOYEE_REMOVAL_PLAN_STALE",
            Map.of("code", "EMPLOYEE_REMOVAL_PLAN_STALE")); }
}
