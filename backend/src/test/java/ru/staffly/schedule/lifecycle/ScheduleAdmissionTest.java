package ru.staffly.schedule.lifecycle;
import org.junit.jupiter.api.Test;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.InvitationScheduleIntentRepository;
import ru.staffly.invite.service.InvitationImpactService;
import ru.staffly.member.lifecycle.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.SchedulePreferenceLifecycleService;
import ru.staffly.user.model.User;
import java.time.Instant;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class ScheduleAdmissionTest {
    final InvitationScheduleIntentRepository intents = mock(InvitationScheduleIntentRepository.class);
    final ScheduleRepository schedules = mock(ScheduleRepository.class);
    final SchedulePreferenceLifecycleService lifecycle = mock(SchedulePreferenceLifecycleService.class);
    final InvitationImpactService impact = new InvitationImpactService(null,null,null,null,null,null,mock(RestaurantTimeService.class));
    final ScheduleAdmissionLifecycleHandler handler = new ScheduleAdmissionLifecycleHandler(intents,schedules,impact,lifecycle);
    final Restaurant restaurant = Restaurant.builder().id(1L).build();
    final Position position = Position.builder().id(2L).restaurant(restaurant).build();
    final User user = User.builder().id(7L).build();
    final Instant now = Instant.parse("2026-10-05T12:00:00Z");
    final AdmissionApplyContext c = new AdmissionApplyContext(Invitation.builder().id(3L).restaurant(restaurant).build(),user,position,now,UUID.randomUUID());
    final RestaurantMember member = RestaurantMember.builder().id(42L).user(user).restaurant(restaurant).position(position).build();
    final Schedule schedule = Schedule.builder().id(10L).version(99L).title("Test").restaurant(restaurant)
            .positions(Set.of(position)).status(ScheduleStatus.DRAFT).build();
    InvitationScheduleIntent intent(InvitationScheduleIntentAction action, Instant deadline) {
        return InvitationScheduleIntent.builder().expectedScheduleId(10L).selectedAction(action).requestedDeadline(deadline)
                .expectedScheduleVersion(1L).expectedScheduleStatus(ScheduleStatus.DRAFT).build();
    }
    void stub(InvitationScheduleIntent i) {
        when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(3L)).thenReturn(List.of(i));
        when(schedules.findAllForUpdateByRestaurantIdAndIdInOrderByIdAsc(1L,List.of(10L))).thenReturn(List.of(schedule));
    }
    @Test void plainDraftAdditionWaitsForApplyAndIgnoresUnrelatedVersionChanges() {
        stub(intent(InvitationScheduleIntentAction.ADD_TO_DRAFT,null));
        var prepared = handler.prepare(c); verifyNoInteractions(lifecycle);
        when(lifecycle.addDraftParticipantWithLocksHeld(schedule,member)).thenReturn(true);
        var effects = prepared.applyAfterMembershipCreated(member);
        verify(lifecycle).addDraftParticipantWithLocksHeld(schedule,member);
        assertEquals(c.operationId(),effects.operationId()); assertEquals(1,effects.scheduleEffects().size());
    }
    @Test void publishedScheduleInvalidatesDraftAdditionBeforeApply() {
        schedule.setStatus(ScheduleStatus.PUBLISHED); stub(intent(InvitationScheduleIntentAction.ADD_TO_DRAFT,null));
        assertThrows(AdmissionPlanInvalidException.class, () -> handler.prepare(c)); verifyNoInteractions(lifecycle);
    }
    @Test void deletedNonMutatingSchedulesDoNotEvenGetLocked() {
        for (var action : List.of(InvitationScheduleIntentAction.DO_NOT_ADD, InvitationScheduleIntentAction.DO_NOT_ADD_TO_DRAFT, InvitationScheduleIntentAction.INFORMATION_ONLY)) {
            when(intents.findByInvitationIdOrderByExpectedScheduleIdAsc(3L)).thenReturn(List.of(intent(action,null)));
            assertTrue(handler.prepare(c).applyAfterMembershipCreated(member).scheduleEffects().isEmpty());
        }
        verifyNoInteractions(schedules,lifecycle);
    }
    @Test void reopenPlanRequiresFutureDeadlineAndRunsOnlyAfterMembershipCreated() {
        schedule.setStatus(ScheduleStatus.PREFERENCES_CLOSED);schedule.setPreferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL);
        stub(intent(InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION,now));
        assertThrows(AdmissionPlanInvalidException.class, () -> handler.prepare(c)); verifyNoInteractions(lifecycle);
        stub(intent(InvitationScheduleIntentAction.ADD_AND_REOPEN_COLLECTION,now.plusSeconds(3600)));
        var prepared = handler.prepare(c); verifyNoInteractions(lifecycle);
        when(lifecycle.reopenForAdmissionWithLocksHeld(schedule,member,now.plusSeconds(3600),7L,now))
                .thenReturn(new SchedulePreferenceLifecycleService.ReopenMutationResult(true,false));
        prepared.applyAfterMembershipCreated(member);
        verify(lifecycle).reopenForAdmissionWithLocksHeld(schedule,member,now.plusSeconds(3600),7L,now);
    }
    @Test void deadlineExtensionCannotShortenTheCurrentCollection() {
        schedule.setStatus(ScheduleStatus.COLLECTING_PREFERENCES);schedule.setPreferenceCollectionMode(PreferenceCollectionMode.DAY_LEVEL);
        schedule.setPreferenceDeadline(now.plusSeconds(7200));
        stub(intent(InvitationScheduleIntentAction.ADD_TO_COLLECTION,now.plusSeconds(3600)));
        assertThrows(AdmissionPlanInvalidException.class, () -> handler.prepare(c)); verifyNoInteractions(lifecycle);
    }
    @Test void missingFrozenVocabularyInvalidatesBeforeMembershipApply() {
        schedule.setStatus(ScheduleStatus.COLLECTING_PREFERENCES);schedule.setPreferenceCollectionMode(PreferenceCollectionMode.SHIFT_OPTIONS);
        schedule.setPreferenceDeadline(now.plusSeconds(7200)); stub(intent(InvitationScheduleIntentAction.ADD_TO_COLLECTION,null));
        assertThrows(AdmissionPlanInvalidException.class, () -> handler.prepare(c)); verifyNoInteractions(lifecycle);
    }
}
