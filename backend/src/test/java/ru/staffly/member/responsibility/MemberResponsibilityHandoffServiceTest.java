package ru.staffly.member.responsibility;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.ConflictException;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.policy.MemberRemovalPolicyService;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.dto.AppliedScheduleOwnershipTransfer;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.service.ScheduleOwnershipService;
import ru.staffly.training.dto.AppliedCertificationOwnershipTransfer;
import ru.staffly.training.model.TrainingExam;
import ru.staffly.training.service.TrainingExamOwnershipService;
import ru.staffly.user.model.User;

import java.util.List;
import java.util.Optional;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.ArgumentMatchers.anyMap;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class MemberResponsibilityHandoffServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock MemberRemovalPolicyService removalPolicy;
    @Mock TrainingExamOwnershipService trainingOwnership;
    @Mock ScheduleOwnershipService scheduleOwnership;
    @Mock InboxMessageService inboxMessages;

    private MemberResponsibilityHandoffService service;
    private Restaurant restaurant;
    private RestaurantMember oldOwner;
    private RestaurantMember ivan;
    private RestaurantMember georgiy;

    @BeforeEach
    void setUp() {
        service = new MemberResponsibilityHandoffService(
                members, removalPolicy, trainingOwnership, scheduleOwnership, inboxMessages);
        restaurant = Restaurant.builder().id(3L).build();
        oldOwner = member(7L, 70L);
        ivan = member(8L, 80L);
        georgiy = member(9L, 90L);
        when(members.findById(7L)).thenReturn(Optional.of(oldOwner));
    }

    @Test
    void groupsAppliedTransfersByRecipientAndKindWithOneOperationId() {
        discoverResponsibilities(List.of(schedule(11L), schedule(12L), schedule(13L)),
                List.of(exam(21L), exam(22L), exam(23L)));
        when(scheduleOwnership.reassignOwnedSchedules(eq(3L), eq(999L), eq(70L), anyMap(), anyMap()))
                .thenReturn(List.of(
                        new AppliedScheduleOwnershipTransfer(11L, "A", 80L),
                        new AppliedScheduleOwnershipTransfer(12L, "B", 80L),
                        new AppliedScheduleOwnershipTransfer(13L, "C", 90L)));
        when(trainingOwnership.batchReassign(eq(3L), eq(999L), eq(70L), anyList()))
                .thenReturn(List.of(
                        new AppliedCertificationOwnershipTransfer(21L, "Cert 1", 80L),
                        new AppliedCertificationOwnershipTransfer(22L, "Cert 2", 90L),
                        new AppliedCertificationOwnershipTransfer(23L, "Cert 3", 90L)));
        when(members.findByRestaurantIdAndUserIdIn(3L, Set.of(80L, 90L)))
                .thenReturn(List.of(ivan, georgiy));

        service.handoff(3L, 7L, 999L, request(
                item(MemberResponsibilityType.SCHEDULE, 11L, 1L, 80L),
                item(MemberResponsibilityType.SCHEDULE, 12L, 1L, 80L),
                item(MemberResponsibilityType.SCHEDULE, 13L, 1L, 90L),
                item(MemberResponsibilityType.CERTIFICATION, 21L, null, 80L),
                item(MemberResponsibilityType.CERTIFICATION, 22L, null, 90L),
                item(MemberResponsibilityType.CERTIFICATION, 23L, null, 90L)));

        ArgumentCaptor<BusinessNotificationCommand> captor = ArgumentCaptor.forClass(BusinessNotificationCommand.class);
        verify(inboxMessages, org.mockito.Mockito.times(4)).createBusinessNotification(captor.capture());
        List<BusinessNotificationCommand> commands = captor.getAllValues();
        assertThat(commands).extracting(BusinessNotificationCommand::operationId).containsOnly(commands.get(0).operationId());
        assertThat(commands).extracting(BusinessNotificationCommand::kind)
                .containsExactlyInAnyOrder(BusinessNotificationKind.SCHEDULE, BusinessNotificationKind.SCHEDULE,
                        BusinessNotificationKind.CERTIFICATION, BusinessNotificationKind.CERTIFICATION);

        BusinessNotificationCommand ivanSchedules = command(commands, 8L, BusinessNotificationKind.SCHEDULE);
        assertThat(ivanSchedules.inboxText()).contains("• A", "• B").doesNotContain("• C");
        assertThat(ivanSchedules.pushText()).isEqualTo("Вам передали ответственность за 2 графика.");
        assertThat(ivanSchedules.metadata()).containsEntry("resourceIds", List.of(11L, 12L));
        assertThat(resourceIds(ivanSchedules)).doesNotContain(13L, 21L, 22L, 23L);
        assertThat(command(commands, 8L, BusinessNotificationKind.CERTIFICATION).metadata())
                .containsEntry("resourceIds", List.of(21L));
        assertThat(command(commands, 9L, BusinessNotificationKind.SCHEDULE).metadata())
                .containsEntry("resourceIds", List.of(13L));
        BusinessNotificationCommand georgiyCertifications = command(commands, 9L, BusinessNotificationKind.CERTIFICATION);
        assertThat(georgiyCertifications.inboxText()).contains("• Cert 2", "• Cert 3").doesNotContain("Cert 1");
        assertThat(georgiyCertifications.metadata()).containsEntry("resourceIds", List.of(22L, 23L));
        assertThat(resourceIds(georgiyCertifications)).doesNotContain(11L, 12L, 13L, 21L);
        assertThat(commands).extracting(command -> command.recipient().getId()).doesNotContain(oldOwner.getId());
        assertThat(commands).allSatisfy(command -> assertThat(command.actor().getId()).isEqualTo(999L));
    }

    @Test
    void fiveSchedulesProduceOneDetailedGroup() {
        List<Schedule> schedules = List.of(schedule(1L), schedule(2L), schedule(3L), schedule(4L), schedule(5L));
        discoverResponsibilities(schedules, List.of());
        when(scheduleOwnership.reassignOwnedSchedules(eq(3L), eq(999L), eq(70L), anyMap(), anyMap()))
                .thenReturn(List.of(
                        new AppliedScheduleOwnershipTransfer(1L, "A", 80L),
                        new AppliedScheduleOwnershipTransfer(2L, "B", 80L),
                        new AppliedScheduleOwnershipTransfer(3L, "C", 80L),
                        new AppliedScheduleOwnershipTransfer(4L, "D", 80L),
                        new AppliedScheduleOwnershipTransfer(5L, "E", 80L)));
        when(members.findByRestaurantIdAndUserIdIn(3L, Set.of(80L))).thenReturn(List.of(ivan));

        service.handoff(3L, 7L, 999L, request(
                item(MemberResponsibilityType.SCHEDULE, 1L, 1L, 80L),
                item(MemberResponsibilityType.SCHEDULE, 2L, 1L, 80L),
                item(MemberResponsibilityType.SCHEDULE, 3L, 1L, 80L),
                item(MemberResponsibilityType.SCHEDULE, 4L, 1L, 80L),
                item(MemberResponsibilityType.SCHEDULE, 5L, 1L, 80L)));

        ArgumentCaptor<BusinessNotificationCommand> captor = ArgumentCaptor.forClass(BusinessNotificationCommand.class);
        verify(inboxMessages).createBusinessNotification(captor.capture());
        assertThat(captor.getValue().inboxText()).contains("• A", "• B", "• C", "• D", "• E");
        assertThat(captor.getValue().pushText()).isEqualTo("Вам передали ответственность за 5 графиков.");
        assertThat(captor.getValue().metadata()).containsEntry("resourceIds", List.of(1L, 2L, 3L, 4L, 5L));
    }

    @Test
    void fiveCertificationsProduceOneDetailedGroup() {
        List<TrainingExam> exams = List.of(exam(5L), exam(4L), exam(3L), exam(2L), exam(1L));
        discoverResponsibilities(List.of(), exams);
        when(trainingOwnership.batchReassign(eq(3L), eq(999L), eq(70L), anyList()))
                .thenReturn(List.of(
                        new AppliedCertificationOwnershipTransfer(5L, "E", 80L),
                        new AppliedCertificationOwnershipTransfer(4L, "D", 80L),
                        new AppliedCertificationOwnershipTransfer(3L, "C", 80L),
                        new AppliedCertificationOwnershipTransfer(2L, "B", 80L),
                        new AppliedCertificationOwnershipTransfer(1L, "A", 80L)));
        when(members.findByRestaurantIdAndUserIdIn(3L, Set.of(80L))).thenReturn(List.of(ivan));

        service.handoff(3L, 7L, 999L, request(
                item(MemberResponsibilityType.CERTIFICATION, 5L, null, 80L),
                item(MemberResponsibilityType.CERTIFICATION, 4L, null, 80L),
                item(MemberResponsibilityType.CERTIFICATION, 3L, null, 80L),
                item(MemberResponsibilityType.CERTIFICATION, 2L, null, 80L),
                item(MemberResponsibilityType.CERTIFICATION, 1L, null, 80L)));

        ArgumentCaptor<BusinessNotificationCommand> captor = ArgumentCaptor.forClass(BusinessNotificationCommand.class);
        verify(inboxMessages).createBusinessNotification(captor.capture());
        BusinessNotificationCommand command = captor.getValue();
        assertThat(command.kind()).isEqualTo(BusinessNotificationKind.CERTIFICATION);
        assertThat(command.inboxText()).contains("• A", "• B", "• C", "• D", "• E");
        assertThat(command.pushText()).isEqualTo("Вам передали ответственность за 5 аттестаций.");
        assertThat(command.metadata()).containsEntry("resourceIds", List.of(1L, 2L, 3L, 4L, 5L));
    }

    @Test
    void actorRecipientIsPassedToCentralSuppressionWithoutCallerFiltering() {
        discoverResponsibilities(List.of(schedule(11L)), List.of());
        when(scheduleOwnership.reassignOwnedSchedules(eq(3L), eq(80L), eq(70L), anyMap(), anyMap()))
                .thenReturn(List.of(new AppliedScheduleOwnershipTransfer(11L, "A", 80L)));
        when(members.findByRestaurantIdAndUserIdIn(3L, Set.of(80L))).thenReturn(List.of(ivan));

        service.handoff(3L, 7L, 80L, request(item(MemberResponsibilityType.SCHEDULE, 11L, 1L, 80L)));

        ArgumentCaptor<BusinessNotificationCommand> captor = ArgumentCaptor.forClass(BusinessNotificationCommand.class);
        verify(inboxMessages).createBusinessNotification(captor.capture());
        assertThat(captor.getValue().actor().getId()).isEqualTo(captor.getValue().recipient().getUser().getId());
        assertThat(captor.getValue().metadata()).containsEntry("resourceIds", List.of(11L));
    }

    @Test
    void failedTransferCreatesNoNotification() {
        discoverResponsibilities(List.of(schedule(11L)), List.of());
        when(scheduleOwnership.reassignOwnedSchedules(eq(3L), eq(999L), eq(70L), anyMap(), anyMap()))
                .thenThrow(new ConflictException("stale"));

        assertThrows(ConflictException.class, () -> service.handoff(
                3L, 7L, 999L, request(item(MemberResponsibilityType.SCHEDULE, 11L, 1L, 80L))));

        verify(inboxMessages, never()).createBusinessNotification(any());
    }

    private void discoverResponsibilities(List<Schedule> schedules, List<TrainingExam> exams) {
        when(scheduleOwnership.findActiveOrFutureOwnedSchedules(3L, 70L)).thenReturn(schedules);
        when(trainingOwnership.findActiveOwnedCertificationExams(3L, 70L)).thenReturn(exams);
    }

    private RestaurantMember member(Long memberId, Long userId) {
        return RestaurantMember.builder().id(memberId).restaurant(restaurant).user(User.builder().id(userId).build()).build();
    }

    private Schedule schedule(Long id) {
        return Schedule.builder().id(id).version(1L).restaurant(restaurant).title("schedule-" + id).build();
    }

    private TrainingExam exam(Long id) {
        return TrainingExam.builder().id(id).restaurant(restaurant).title("exam-" + id).build();
    }

    private MemberResponsibilityHandoffRequest request(MemberResponsibilityHandoffRequest.Item... items) {
        return new MemberResponsibilityHandoffRequest(List.of(items));
    }

    private MemberResponsibilityHandoffRequest.Item item(
            MemberResponsibilityType type, Long resourceId, Long version, Long newOwnerUserId) {
        return new MemberResponsibilityHandoffRequest.Item(type, resourceId, version, newOwnerUserId);
    }

    private BusinessNotificationCommand command(
            List<BusinessNotificationCommand> commands, Long recipientMemberId, BusinessNotificationKind kind) {
        return commands.stream()
                .filter(command -> command.recipient().getId().equals(recipientMemberId) && command.kind() == kind)
                .findFirst()
                .orElseThrow();
    }

    private List<Long> resourceIds(BusinessNotificationCommand command) {
        Object value = command.metadata().get("resourceIds");
        assertThat(value).isInstanceOf(List.class);
        return ((List<?>) value).stream().map(Long.class::cast).toList();
    }
}
