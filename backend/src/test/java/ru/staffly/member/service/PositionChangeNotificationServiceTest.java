package ru.staffly.member.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationAfterCommitService;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.member.dto.*;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.training.dto.*;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.util.*;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class PositionChangeNotificationServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock BusinessNotificationAfterCommitService afterCommit;
    private PositionChangeNotificationService service;
    private RestaurantMember subject;
    private User actor;
    private final UUID operationId = UUID.fromString("20000000-0000-0000-0000-000000000001");

    @BeforeEach void setUp() {
        service = new PositionChangeNotificationService(members, afterCommit);
        Restaurant restaurant = Restaurant.builder().id(1L).build();
        subject = RestaurantMember.builder().id(345L).restaurant(restaurant)
                .user(User.builder().id(7L).fullName("Владимир").build()).build();
        actor = User.builder().id(8L).fullName("Менеджер").build();
    }

    @Test void simpleChangeCreatesOnlyBaseEmployeeOpportunity() {
        service.submit(subject, actor, operationId, "Официант", "Бармен", List.of(), List.of());
        var commands = captured();
        assertThat(commands).singleElement().satisfies(c -> {
            assertThat(c.kind()).isEqualTo(BusinessNotificationKind.POSITION_CHANGE);
            assertThat(c.recipient()).isSameAs(subject);
            assertThat(c.actor()).isSameAs(actor);
            assertThat(c.inboxText()).contains("Официант", "Бармен");
        });
        verifyNoInteractions(members);
    }

    @Test void collapsesEffectsAndGroupsSchedulesAndCertificationsByCurrentOwner() {
        RestaurantMember owner = owner(101L, 20L);
        RestaurantMember otherOwner = owner(102L, 30L);
        when(members.findByRestaurantIdAndUserIdIn(eq(1L), anySet())).thenReturn(List.of(owner, otherOwner));
        var first = schedule(12L, 20L, EnumSet.of(PositionChangeScheduleEffectType.OLD_PARTICIPATION_REMOVED,
                PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED,
                PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED,
                PositionChangeScheduleEffectType.COLLECTION_REOPENED), Instant.parse("2030-01-02T00:00:00Z"), 0);
        var second = schedule(11L, 20L, EnumSet.of(
                PositionChangeScheduleEffectType.PUBLISHED_FUTURE_SHIFTS_CANCELLED), null, 5);
        var draft = schedule(13L, 30L, EnumSet.of(PositionChangeScheduleEffectType.DRAFT_EMPLOYEE_REMOVED,
                PositionChangeScheduleEffectType.AUTO_BUILD_RESULT_INVALIDATED), null, 0);
        List<AppliedCertificationAudienceEffect> certs = List.of(
                cert(23L, 20L, CertificationAudienceEffectType.REACTIVATED),
                cert(21L, 20L, CertificationAudienceEffectType.CREATED),
                cert(22L, 20L, CertificationAudienceEffectType.UNCHANGED),
                cert(31L, 30L, CertificationAudienceEffectType.AUDIENCE_REMOVED));

        service.submit(subject, actor, operationId, "Официант", "Бармен", List.of(first, second, draft), certs);
        var commands = captured();
        assertThat(commands).hasSize(7).extracting(BusinessNotificationCommand::operationId).containsOnly(operationId);
        assertThat(command(commands, 101L, BusinessNotificationKind.SCHEDULE).metadata().get("resourceIds"))
                .isEqualTo(List.of(11L, 12L));
        assertThat(command(commands, 102L, BusinessNotificationKind.SCHEDULE).metadata().get("resourceIds"))
                .isEqualTo(List.of(13L));
        assertThat(command(commands, 101L, BusinessNotificationKind.CERTIFICATION).metadata().get("resourceIds"))
                .isEqualTo(List.of(21L, 23L));
        assertThat(command(commands, 102L, BusinessNotificationKind.CERTIFICATION).metadata().get("resourceIds"))
                .isEqualTo(List.of(31L));
        assertThat(commands.stream().filter(c -> c.recipient() == subject).map(BusinessNotificationCommand::kind))
                .containsExactlyInAnyOrder(BusinessNotificationKind.POSITION_CHANGE,
                        BusinessNotificationKind.POSITION_CHANGE_PREFERENCES,
                        BusinessNotificationKind.POSITION_CHANGE_SHIFTS);
        assertThat(commands.stream().filter(c -> c.recipient() == subject).map(BusinessNotificationCommand::inboxText))
                .noneMatch(t -> t.contains("автоматический") || t.contains("черновика") || t.contains("аудитории"));
    }

    @Test void skipsMissingOwnerButKeepsEmployeeNotificationAndDoesNotSuppressActorOwnerAtCaller() {
        RestaurantMember actorOwner = RestaurantMember.builder().id(88L).restaurant(subject.getRestaurant()).user(actor).build();
        when(members.findByRestaurantIdAndUserIdIn(1L, Set.of(8L, 99L))).thenReturn(List.of(actorOwner));
        service.submit(subject, actor, operationId, "А", "Б", List.of(
                schedule(1L, 99L, EnumSet.of(PositionChangeScheduleEffectType.DRAFT_EMPLOYEE_REMOVED), null, 0),
                schedule(2L, 8L, EnumSet.of(PositionChangeScheduleEffectType.DRAFT_EMPLOYEE_REMOVED), null, 0)), List.of());
        var commands = captured();
        assertThat(commands).hasSize(2);
        assertThat(command(commands, 88L, BusinessNotificationKind.SCHEDULE).actor()).isSameAs(actor);
    }

    @Test void fiveSchedulesForOneOwnerProduceOneSortedOwnerGroup() {
        RestaurantMember owner = owner(101L, 20L);
        when(members.findByRestaurantIdAndUserIdIn(1L, Set.of(20L))).thenReturn(List.of(owner));
        var effects = List.of(5L, 1L, 4L, 2L, 3L).stream()
                .map(id -> schedule(id, 20L,
                        EnumSet.of(PositionChangeScheduleEffectType.DRAFT_EMPLOYEE_REMOVED), null, 0))
                .toList();

        service.submit(subject, actor, operationId, "А", "Б", effects, List.of());

        var ownerCommands = captured().stream()
                .filter(c -> c.recipient() == owner && c.kind() == BusinessNotificationKind.SCHEDULE).toList();
        assertThat(ownerCommands).singleElement().satisfies(command -> {
            assertThat(command.metadata()).containsEntry("resourceIds", List.of(1L, 2L, 3L, 4L, 5L))
                    .containsEntry("memberId", 345L);
            assertThat(command.inboxText()).contains("График 1", "График 2", "График 3", "График 4", "График 5");
            assertThat(command.pushText()).isNotBlank();
        });
    }

    @Test void fiveCertificationsForOneOwnerProduceOneSortedOwnerGroup() {
        RestaurantMember owner = owner(101L, 20L);
        when(members.findByRestaurantIdAndUserIdIn(1L, Set.of(20L))).thenReturn(List.of(owner));
        var effects = List.of(15L, 11L, 14L, 12L, 13L).stream()
                .map(id -> cert(id, 20L, CertificationAudienceEffectType.CREATED)).toList();

        service.submit(subject, actor, operationId, "А", "Б", List.of(), effects);

        var ownerCommands = captured().stream()
                .filter(c -> c.recipient() == owner && c.kind() == BusinessNotificationKind.CERTIFICATION).toList();
        assertThat(ownerCommands).singleElement().satisfies(command -> {
            assertThat(command.metadata()).containsEntry("resourceIds", List.of(11L, 12L, 13L, 14L, 15L))
                    .containsEntry("memberId", 345L);
            assertThat(command.pushText()).isNotBlank();
        });
    }

    @Test void lostSubmissionsAcrossSchedulesProduceOneActionableEmployeeGroup() {
        var consequences = EnumSet.of(PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED,
                PositionChangeScheduleEffectType.NEW_PARTICIPATION_CREATED);

        service.submit(subject, actor, operationId, "А", "Б", List.of(
                schedule(2L, null, consequences, null, 0),
                schedule(1L, null, consequences, Instant.parse("2030-01-02T00:00:00Z"), 0)), List.of());

        var employeePreferenceCommands = captured().stream()
                .filter(c -> c.kind() == BusinessNotificationKind.POSITION_CHANGE_PREFERENCES).toList();
        assertThat(employeePreferenceCommands).singleElement().satisfies(command -> {
            assertThat(command.metadata().get("resourceIds")).isEqualTo(List.of(1L, 2L));
            assertThat(command.inboxText()).contains("График 1", "График 2", "2030-01-02");
        });
    }

    @Test void removedSubmissionWithoutActualNewParticipationIsNotActionable() {
        service.submit(subject, actor, operationId, "А", "Б", List.of(schedule(1L, null,
                EnumSet.of(PositionChangeScheduleEffectType.PREFERENCE_SUBMISSION_REMOVED), null, 0)), List.of());

        assertThat(captured()).extracting(BusinessNotificationCommand::kind)
                .containsExactly(BusinessNotificationKind.POSITION_CHANGE);
    }

    @Test void touchedPublishedScheduleWithoutActualCancellationDoesNotNotifyEmployeeAboutShifts() {
        service.submit(subject, actor, operationId, "А", "Б", List.of(schedule(1L, null,
                EnumSet.of(PositionChangeScheduleEffectType.OLD_PARTICIPATION_REMOVED), null, 0)), List.of());

        assertThat(captured()).extracting(BusinessNotificationCommand::kind)
                .containsExactly(BusinessNotificationKind.POSITION_CHANGE);
    }

    @Test void multiplePublishedCancellationsProduceOneEmployeeShiftGroup() {
        service.submit(subject, actor, operationId, "А", "Б", List.of(
                schedule(2L, null, EnumSet.of(
                        PositionChangeScheduleEffectType.PUBLISHED_FUTURE_SHIFTS_CANCELLED), null, 4),
                schedule(1L, null, EnumSet.of(
                        PositionChangeScheduleEffectType.PUBLISHED_FUTURE_SHIFTS_CANCELLED), null, 2)), List.of());

        var shiftCommands = captured().stream()
                .filter(c -> c.kind() == BusinessNotificationKind.POSITION_CHANGE_SHIFTS).toList();
        assertThat(shiftCommands).singleElement().satisfies(command ->
                assertThat(command.metadata().get("resourceIds")).isEqualTo(List.of(1L, 2L)));
    }

    @SuppressWarnings("unchecked") private List<BusinessNotificationCommand> captured() {
        ArgumentCaptor<List<BusinessNotificationCommand>> captor = ArgumentCaptor.forClass(List.class);
        verify(afterCommit).submit(captor.capture());
        return captor.getValue();
    }
    private RestaurantMember owner(long memberId, long userId) {
        return RestaurantMember.builder().id(memberId).restaurant(subject.getRestaurant())
                .user(User.builder().id(userId).fullName("Owner " + userId).build()).build();
    }
    private AppliedPositionChangeScheduleEffect schedule(long id, Long owner, Set<PositionChangeScheduleEffectType> effects,
                                                         Instant deadline, int cancelled) {
        return new AppliedPositionChangeScheduleEffect(id, "График " + id, owner, subject.getId(), effects, deadline, cancelled);
    }
    private AppliedCertificationAudienceEffect cert(long id, long owner, CertificationAudienceEffectType type) {
        return new AppliedCertificationAudienceEffect(id, "Аттестация " + id, owner, subject.getUser().getId(), type);
    }
    private BusinessNotificationCommand command(List<BusinessNotificationCommand> commands, Long recipient,
                                                BusinessNotificationKind kind) {
        return commands.stream().filter(c -> c.recipient().getId().equals(recipient) && c.kind() == kind)
                .findFirst().orElseThrow();
    }
}
