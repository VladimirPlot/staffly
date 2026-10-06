package ru.staffly.schedule.lifecycle;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.dto.ApplyPositionChangeRequest.ScheduleDecision;
import ru.staffly.member.dto.PositionChangeImpactPlan.Action;
import ru.staffly.member.lifecycle.PositionChangeApplyContext;
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

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:position-change;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class SchedulePositionChangePersistenceTest {
    @Autowired EntityManager em;
    @Autowired ScheduleRepository schedules;
    @Autowired ScheduleParticipationRepository participations;
    @Autowired SchedulePreferenceSubmissionRepository submissions;
    @Autowired RestaurantMemberRepository members;
    private final Instant now = Instant.parse("2026-10-05T12:00:00Z");

    private SchedulePreferenceLifecycleService lifecycle() {
        return new SchedulePreferenceLifecycleService(members, schedules, participations, submissions,
                new ScheduleParticipationCreator(participations), new ScheduleRowMaterializer(),
                mock(ScheduleAuditService.class));
    }

    // Exercise both a previously loaded aggregate and a lazy participation collection.
    @ParameterizedTest
    @ValueSource(booleans = {false, true})
    void publishedDepartureAndDraftAdmissionSurviveFlushAndReload(boolean initializeParticipations) {
        var restaurant = Restaurant.builder().name("Restaurant").code("regression").timezone("UTC").build();
        em.persist(restaurant);
        var oldPosition = position(restaurant, "Position A");
        var targetPosition = position(restaurant, "Position B");
        var user = User.builder().phone("+70000000001").email("regression@example.com")
                .firstName("Test").lastName("Member").passwordHash("test").build();
        em.persist(user);
        var startedAt = now.minusSeconds(86400 * 30);
        var member = RestaurantMember.builder().restaurant(restaurant).user(user).position(oldPosition)
                .startedAt(startedAt).build();
        em.persist(member);
        var published = schedule(restaurant, oldPosition, ScheduleStatus.PUBLISHED);
        var draft = schedule(restaurant, targetPosition, ScheduleStatus.DRAFT);
        var participation = participations.save(ScheduleParticipation.builder().schedule(published).member(member)
                .positionId(oldPosition.getId()).positionName(oldPosition.getName()).build());
        var submission = submissions.save(SchedulePreferenceSubmission.builder().schedule(published).member(member)
                .positionId(oldPosition.getId()).positionName(oldPosition.getName()).build());
        var row = new ScheduleRowMaterializer().ensureRowWithLocksHeld(published, member, participation);
        shift(row, LocalDate.of(2026, 10, 4));
        shift(row, LocalDate.of(2026, 10, 5));
        shift(row, LocalDate.of(2026, 10, 6));
        em.flush();
        Long memberId = member.getId(), publishedId = published.getId(), draftId = draft.getId();
        Long rowId = row.getId(), oldPositionId = oldPosition.getId(), targetPositionId = targetPosition.getId();
        Long participationId = participation.getId(), submissionId = submission.getId();
        Long publishedVersion = published.getVersion(), draftVersion = draft.getVersion();
        em.clear();

        member = members.findForUpdateByIdAndRestaurantId(memberId, restaurant.getId()).orElseThrow();
        oldPosition = em.find(Position.class, oldPositionId);
        targetPosition = em.find(Position.class, targetPositionId);
        if (initializeParticipations) {
            assertEquals(1, em.find(Schedule.class, publishedId).getParticipations().size());
        }
        var time = mock(RestaurantTimeService.class);
        when(time.zoneFor(any(Restaurant.class))).thenReturn(ZoneOffset.UTC);
        var handler = new SchedulePositionChangeApplyHandler(schedules, participations, submissions, lifecycle(),
                time, new PublishedShiftImpactClassifier(), mock(ScheduleOwnershipService.class), em, members);
        var context = new PositionChangeApplyContext(restaurant.getId(), user.getId(), member, oldPosition,
                targetPosition, now, UUID.randomUUID());
        var decision = new SchedulePositionChangeDecision(List.of(
                new ScheduleDecision(publishedId, publishedVersion, ScheduleStatus.PUBLISHED, 0L, null,
                        participationId, submissionId, 1, null, null),
                new ScheduleDecision(draftId, draftVersion, ScheduleStatus.DRAFT, 0L, null,
                        null, null, null, Action.ADD_TO_DRAFT, null)), List.of(), List.of());
        var preparation = handler.applyBefore(context, decision);
        member.setPosition(targetPosition);
        var result = handler.applyAfter(context, decision, preparation);
        assertEquals(1, result.cancelledFutureShiftCount());
        em.flush();
        em.clear();

        var reloadedMember = em.find(RestaurantMember.class, memberId);
        assertEquals(memberId, reloadedMember.getId());
        assertEquals(startedAt, reloadedMember.getStartedAt());
        assertEquals(targetPositionId, reloadedMember.getPosition().getId());
        assertNull(reloadedMember.getEndedAt());
        assertEquals(0L, ((Number) em.createNativeQuery("select count(*) from schedule_participation "
                + "where schedule_id = :schedule and member_id = :member")
                .setParameter("schedule", publishedId).setParameter("member", memberId).getSingleResult()).longValue());
        assertTrue(participations.findByScheduleIdAndMemberId(publishedId, memberId).isEmpty());
        assertTrue(submissions.findByScheduleIdAndMemberId(publishedId, memberId).isEmpty());
        published = em.find(Schedule.class, publishedId);
        assertEquals(ScheduleStatus.PUBLISHED, published.getStatus());
        assertTrue(published.getParticipations().isEmpty());
        assertEquals(1, published.getRows().size());
        row = published.getRows().get(0);
        assertEquals(rowId, row.getId());
        assertTrue(row.isHistorical());
        assertEquals(oldPositionId, row.getPositionId());
        assertEquals("Position A", row.getPositionName());
        assertEquals(Set.of(LocalDate.of(2026, 10, 4), LocalDate.of(2026, 10, 5)),
                row.getCells().stream().map(ScheduleCell::getDay).collect(java.util.stream.Collectors.toSet()));
        assertTrue(row.getCells().stream().allMatch(ScheduleCell::hasStructuredShift));
        draft = em.find(Schedule.class, draftId);
        assertEquals(ScheduleStatus.DRAFT, draft.getStatus());
        assertEquals(1, draft.getParticipations().size());
        assertEquals(memberId, draft.getParticipations().get(0).getMember().getId());
        assertEquals(targetPositionId, draft.getParticipations().get(0).getPositionId());
        assertEquals(1, draft.getRows().size());
        assertFalse(draft.getRows().get(0).isHistorical());
        assertEquals(memberId, draft.getRows().get(0).getMemberId());
        assertEquals(targetPositionId, draft.getRows().get(0).getPositionId());
        // A subsequent aggregate save must not restore the removed child either.
        schedules.saveAll(List.of(published, draft));
        em.flush();
        em.clear();
        assertTrue(participations.findByScheduleIdAndMemberId(publishedId, memberId).isEmpty());
    }

    private Position position(Restaurant restaurant, String name) {
        var position = Position.builder().restaurant(restaurant).name(name).build();
        em.persist(position);
        return position;
    }

    private Schedule schedule(Restaurant restaurant, Position position, ScheduleStatus status) {
        var schedule = Schedule.builder().restaurant(restaurant).title(status.name()).status(status)
                .startDate(LocalDate.of(2026, 10, 1)).endDate(LocalDate.of(2026, 10, 31))
                .shiftMode(ScheduleShiftMode.FULL).build();
        schedule.getPositions().add(position);
        em.persist(schedule);
        return schedule;
    }

    private void shift(ScheduleRow row, LocalDate day) {
        var cell = ScheduleCell.builder().row(row).day(day).value("09:00-17:00").build();
        cell.setStructuredShift(new CanonicalBusinessInterval(LocalTime.of(9, 0), 0, LocalTime.of(17, 0), 0));
        row.getCells().add(cell);
    }
}
