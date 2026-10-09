package ru.staffly.schedule.lifecycle;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.EnumSource;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.dto.ApplyEmployeeRemovalRequest.ScheduleToken;
import ru.staffly.member.dto.EmployeeRemovalImpactPlan.ScheduleImpact;
import ru.staffly.member.dto.PublishedShiftImpact;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.PublishedShiftImpactClassifier;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.*;
import ru.staffly.schedule.service.*;
import ru.staffly.user.model.User;

import java.time.*;
import java.util.*;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Compare the real preview and Apply handlers, including flush/reload of removed children. */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:termination-consistency;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ScheduleTerminationConsistencyTest {
    @Autowired EntityManager em;
    @Autowired ScheduleRepository schedules;
    @Autowired ScheduleParticipationRepository participations;
    @Autowired SchedulePreferenceSubmissionRepository submissions;
    @Autowired RestaurantMemberRepository members;
    private final Instant now = Instant.parse("2026-10-05T12:00:00Z");
    private final ScheduleOwnershipService ownership = mock(ScheduleOwnershipService.class);
    private RestaurantMember member;
    private Schedule schedule;
    private ScheduleRow row;

    @ParameterizedTest @EnumSource(ScheduleStatus.class)
    void participationAndSubmissionRemovalMatchesPreviewInEveryStatus(ScheduleStatus status) {
        fixture(status, true, true, true, false);
        assertPreviewAndApply(true, true, true, false);
    }

    @ParameterizedTest @EnumSource(ScheduleStatus.class)
    void participationOnlyDoesNotClaimPreferenceDeletion(ScheduleStatus status) {
        fixture(status, true, false, true, false);
        assertPreviewAndApply(true, false, true, false);
    }

    @ParameterizedTest @EnumSource(ScheduleStatus.class)
    void submissionOnlyDoesNotClaimParticipationOrDenominatorRemoval(ScheduleStatus status) {
        fixture(status, false, true, true, false);
        assertPreviewAndApply(false, true, true, false);
    }

    @ParameterizedTest @EnumSource(ScheduleStatus.class)
    void rowOnlyHasNoFalsePositiveParticipationOrSubmissionFlags(ScheduleStatus status) {
        fixture(status, false, false, true, false);
        assertPreviewAndApply(false, false, true, false);
    }

    @ParameterizedTest @EnumSource(ScheduleStatus.class)
    void participationWithoutRowHasNoRowOrShiftEffects(ScheduleStatus status) {
        fixture(status, true, false, false, false);
        assertPreviewAndApply(true, false, false, false);
    }

    @ParameterizedTest @EnumSource(ScheduleStatus.class)
    void historicalRowIsPreservedWithoutNewRowOrShiftEffects(ScheduleStatus status) {
        fixture(status, false, false, true, true);
        assertPreviewAndApply(false, false, true, true);
    }

    @ParameterizedTest
    @ValueSource(strings = {"version", "status", "cycle", "deadline", "participation", "submission", "revision", "missing", "extra"})
    void staleSnapshotStillRejectsBeforeScheduleMutation(String changed) {
        fixture(ScheduleStatus.PUBLISHED, true, true, true, false);
        var impact = preview();
        var token = new ScheduleToken(impact.scheduleId(),
                impact.scheduleVersion() + (changed.equals("version") ? 1 : 0),
                changed.equals("status") ? ScheduleStatus.DRAFT : impact.scheduleStatus(),
                impact.preferenceCollectionCycle() + (changed.equals("cycle") ? 1 : 0),
                changed.equals("deadline") ? now.plusSeconds(1) : impact.currentPreferenceDeadline(),
                changed.equals("participation") ? null : impact.participationId(),
                changed.equals("submission") ? null : impact.preferenceSubmissionId(),
                impact.preferenceSubmissionRevision() + (changed.equals("revision") ? 1 : 0));
        var tokens = new ArrayList<>(List.of(token));
        if (changed.equals("missing")) tokens.clear();
        if (changed.equals("extra")) tokens.add(new ScheduleToken(-1L, 0L, ScheduleStatus.DRAFT, 0L, null, null, null, null));
        var ex = assertThrows(ConflictException.class, () -> apply(tokens));
        assertTrue(ex.getMessage().contains("EMPLOYEE_REMOVAL_PLAN_STALE"));
        em.flush();
        em.clear();
        var reloaded = em.find(Schedule.class, schedule.getId());
        assertEquals(impact.scheduleVersion(), reloaded.getVersion());
        assertFalse(reloaded.getRows().get(0).isHistorical());
        assertEquals(4, reloaded.getRows().get(0).getCells().size());
        assertTrue(participations.findByScheduleIdAndMemberId(schedule.getId(), member.getId()).isPresent());
        assertTrue(submissions.findByScheduleIdAndMemberId(schedule.getId(), member.getId()).isPresent());
        assertNull(reloaded.getAutoBuildStaleAt());
    }

    private ScheduleImpact preview() {
        var handler = new ScheduleTerminationPreviewHandler(schedules, time(), participations, submissions,
                new PublishedShiftImpactClassifier(), ownership);
        var impacts = handler.preview(new TerminationPreviewContext(member.getRestaurant().getId(), member.getUser().getId(),
                member, TerminationMode.FORCED, now)).schedules();
        assertEquals(1, impacts.size());
        return impacts.get(0);
    }

    private ScheduleTerminationResult apply(List<ScheduleToken> tokens) {
        var lifecycle = new SchedulePreferenceLifecycleService(members, schedules, participations, submissions,
                new ScheduleParticipationCreator(participations), new ScheduleRowMaterializer(), mock(ScheduleAuditService.class));
        var handler = new ScheduleTerminationApplyHandler(schedules, participations, submissions, lifecycle,
                new PublishedShiftImpactClassifier(), time(), ownership, mock(ScheduleBuildMarkerMemberRepository.class));
        return handler.apply(new TerminationApplyContext(member.getRestaurant().getId(), member.getUser().getId(),
                member, TerminationMode.FORCED, now, UUID.randomUUID()), new ScheduleTerminationDecision(tokens, List.of()));
    }

    private RestaurantTimeService time() {
        var time = mock(RestaurantTimeService.class);
        when(time.zoneFor(any(Restaurant.class))).thenReturn(ZoneOffset.UTC);
        return time;
    }

    private void assertPreviewAndApply(boolean hasParticipation, boolean hasSubmission, boolean hasRow, boolean historical) {
        var impact = preview();
        var status = schedule.getStatus();
        boolean active = hasRow && !historical;
        boolean draft = status == ScheduleStatus.DRAFT || status == ScheduleStatus.DRAFT_FROM_PREFERENCES;
        boolean published = status == ScheduleStatus.PUBLISHED && active;
        assertEquals(hasParticipation, impact.participationWillBeRemoved());
        assertEquals(hasSubmission, impact.preferenceDataWillBeDeleted());
        assertEquals(status == ScheduleStatus.COLLECTING_PREFERENCES && hasParticipation, impact.progressDenominatorWillChange());
        assertEquals(status == ScheduleStatus.DRAFT_FROM_PREFERENCES, impact.autoBuildWillBecomeStale());
        assertEquals(draft && active, impact.activeDraftRowWillBeRemoved());
        assertEquals(published, impact.publishedRowBecomesHistorical());
        assertEquals(published ? new PublishedShiftImpact(1, 1, 1, 1) : null, impact.publishedShiftImpact());
        int denominatorBefore = schedule.getParticipations().size();
        Long rowId = hasRow ? row.getId() : null;
        var result = apply(List.of(new ScheduleToken(impact.scheduleId(), impact.scheduleVersion(), impact.scheduleStatus(),
                impact.preferenceCollectionCycle(), impact.currentPreferenceDeadline(), impact.participationId(),
                impact.preferenceSubmissionId(), impact.preferenceSubmissionRevision())));
        var effect = result.affectedSchedules().get(0);
        assertEquals(impact.participationWillBeRemoved(), effect.participationRemoved());
        assertEquals(impact.preferenceDataWillBeDeleted(), effect.preferencesRemoved());
        assertEquals(impact.autoBuildWillBecomeStale(), effect.autoBuildBecameStale());
        assertEquals(impact.publishedRowBecomesHistorical(), effect.historicalRowPreserved());
        assertEquals(hasParticipation ? 1 : 0, result.removedParticipationCount());
        assertEquals(hasSubmission ? 1 : 0, result.removedPreferenceSubmissionCount());
        assertEquals(published ? impact.publishedShiftImpact().futureToCancel() : 0, result.cancelledFutureShiftCount());
        if (status == ScheduleStatus.COLLECTING_PREFERENCES) {
            assertEquals(impact.progressDenominatorWillChange(), denominatorBefore != schedule.getParticipations().size());
        }
        em.flush();
        em.clear();
        schedule = em.find(Schedule.class, schedule.getId());
        assertTrue(participations.findByScheduleIdAndMemberId(schedule.getId(), member.getId()).isEmpty());
        assertTrue(submissions.findByScheduleIdAndMemberId(schedule.getId(), member.getId()).isEmpty());
        assertEquals(status, schedule.getStatus());
        assertEquals(impact.currentPreferenceDeadline(), schedule.getPreferenceDeadline());
        assertEquals(impact.preferenceCollectionCycle(), schedule.getPreferenceCollectionCycle());
        assertEquals(hasRow && (historical || published) ? 1 : 0, schedule.getRows().size());
        if (impact.activeDraftRowWillBeRemoved() || (active && status != ScheduleStatus.PUBLISHED)) {
            assertNull(em.find(ScheduleRow.class, rowId));
        }
        if (!schedule.getRows().isEmpty()) {
            var retained = schedule.getRows().get(0);
            assertEquals(rowId, retained.getId());
            assertTrue(retained.isHistorical());
            assertEquals(published ? 3 : 4, retained.getCells().size());
            if (published) assertTrue(retained.getCells().stream().noneMatch(cell -> cell.hasStructuredShift()
                    && cell.physicalStart().isAfter(LocalDateTime.ofInstant(now, ZoneOffset.UTC))));
        }
        assertEquals(impact.autoBuildWillBecomeStale() ? now : null, schedule.getAutoBuildStaleAt());
        assertEquals(impact.autoBuildWillBecomeStale() ? AutoBuildStaleReason.MEMBER_TERMINATED : null,
                schedule.getAutoBuildStaleReason());
        // Saving the aggregate again must not resurrect removed participation via cascading.
        schedules.save(schedule);
        em.flush();
        em.clear();
        assertTrue(participations.findByScheduleIdAndMemberId(schedule.getId(), member.getId()).isEmpty());
    }

    private void fixture(ScheduleStatus status, boolean hasParticipation, boolean hasSubmission, boolean hasRow, boolean historical) {
        var restaurant = Restaurant.builder().name("Restaurant").code("termination").timezone("UTC").build();
        em.persist(restaurant);
        var position = Position.builder().restaurant(restaurant).name("Position").build();
        em.persist(position);
        var user = User.builder().phone("+70000000001").email("termination@example.com")
                .firstName("Test").lastName("Member").passwordHash("test").build();
        em.persist(user);
        member = RestaurantMember.builder().restaurant(restaurant).user(user).position(position).startedAt(now.minusSeconds(86400)).build();
        em.persist(member);
        schedule = Schedule.builder().restaurant(restaurant).title(status.name()).status(status)
                .startDate(LocalDate.of(2026, 10, 1)).endDate(LocalDate.of(2026, 10, 31)).shiftMode(ScheduleShiftMode.FULL).build();
        schedule.getPositions().add(position);
        em.persist(schedule);
        if (hasParticipation) {
            var participation = ScheduleParticipation.builder().schedule(schedule).member(member)
                    .positionId(position.getId()).positionName(position.getName()).build();
            schedule.getParticipations().add(participation);
        }
        if (hasSubmission) submissions.save(SchedulePreferenceSubmission.builder().schedule(schedule).member(member)
                .positionId(position.getId()).positionName(position.getName()).build());
        if (hasRow) {
            row = ScheduleRow.builder().schedule(schedule).memberId(member.getId()).positionId(position.getId())
                    .displayName("Test Member").positionName(position.getName()).historical(historical).build();
            schedule.getRows().add(row);
            for (int day : List.of(4, 5, 6)) {
                var cell = ScheduleCell.builder().row(row).day(LocalDate.of(2026, 10, day)).value("09:00-17:00").build();
                cell.setStructuredShift(new CanonicalBusinessInterval(LocalTime.of(9, 0), 0, LocalTime.of(17, 0), 0));
                row.getCells().add(cell);
            }
            row.getCells().add(ScheduleCell.builder().row(row).day(LocalDate.of(2026, 10, 7)).value("legacy").build());
        }
        em.flush();
        Long scheduleId = schedule.getId(), memberId = member.getId();
        em.clear();
        member = em.find(RestaurantMember.class, memberId);
        schedule = em.find(Schedule.class, scheduleId);
        row = hasRow ? schedule.getRows().get(0) : null;
    }
}
