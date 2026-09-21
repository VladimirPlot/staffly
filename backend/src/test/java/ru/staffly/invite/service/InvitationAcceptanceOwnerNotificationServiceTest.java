package ru.staffly.invite.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.ArgumentCaptor;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.dictionary.model.Position;
import ru.staffly.inbox.model.BusinessNotificationKind;
import ru.staffly.inbox.service.BusinessNotificationAfterCommitService;
import ru.staffly.inbox.service.BusinessNotificationCommand;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.dto.AppliedInvitationScheduleEffect;
import ru.staffly.training.dto.AppliedCertificationAudienceEffect;
import ru.staffly.training.dto.CertificationAudienceEffectType;
import ru.staffly.user.model.User;

import java.util.List;
import java.util.Set;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.anyList;
import static org.mockito.Mockito.*;

@ExtendWith(MockitoExtension.class)
class InvitationAcceptanceOwnerNotificationServiceTest {
    @Mock RestaurantMemberRepository members;
    @Mock BusinessNotificationAfterCommitService afterCommit;

    private InvitationAcceptanceOwnerNotificationService service;
    private Restaurant restaurant;
    private RestaurantMember accepted;
    private User actor;
    private RestaurantMember ownerOne;
    private RestaurantMember ownerTwo;

    @BeforeEach
    void setUp() {
        service = new InvitationAcceptanceOwnerNotificationService(members, afterCommit);
        restaurant = Restaurant.builder().id(1L).build();
        actor = User.builder().id(10L).fullName("Автор принятия").build();
        User subject = User.builder().id(11L).fullName("Владимир").build();
        accepted = RestaurantMember.builder().id(345L).restaurant(restaurant).user(subject)
                .position(Position.builder().id(5L).name("Официант").build()).build();
        ownerOne = member(101L, 20L, "Георгий");
        ownerTwo = member(102L, 30L, "Эдуард");
    }

    @Test
    void groupsByCurrentRecipientAndKindWithOneOperationAndIsolatedSortedMetadata() {
        when(members.findByRestaurantIdAndUserIdIn(eq(1L), anySet())).thenReturn(List.of(ownerOne, ownerTwo));

        service.submit(accepted, actor,
                List.of(schedule(12L, "Б", 20L), schedule(11L, "А", 20L), schedule(13L, "В", 30L)),
                List.of(cert(23L, "Три", 20L, CertificationAudienceEffectType.REACTIVATED),
                        cert(21L, "Один", 20L, CertificationAudienceEffectType.CREATED),
                        cert(22L, "Два", 20L, CertificationAudienceEffectType.UNCHANGED),
                        cert(31L, "Четыре", 30L, CertificationAudienceEffectType.CREATED)));

        ArgumentCaptor<List<BusinessNotificationCommand>> captor = ArgumentCaptor.forClass(List.class);
        verify(afterCommit).submit(captor.capture());
        List<BusinessNotificationCommand> commands = captor.getValue();
        assertThat(commands).hasSize(4);
        assertThat(commands).extracting(BusinessNotificationCommand::operationId).containsOnly(commands.get(0).operationId());
        assertThat(commands).allSatisfy(command -> assertThat(command.actor()).isSameAs(actor));
        assertThat(commands).allSatisfy(command -> {
            assertThat(command.inboxText()).contains("Владимир").doesNotContain("Автор принятия");
            assertThat(command.pushText()).contains("Владимир").doesNotContain("Автор принятия");
        });

        BusinessNotificationCommand ownerOneSchedules = command(commands, 101L, BusinessNotificationKind.SCHEDULE);
        assertThat(ownerOneSchedules.metadata()).containsOnlyKeys("resourceIds", "memberId");
        assertThat(ownerOneSchedules.metadata().get("resourceIds")).isEqualTo(List.of(11L, 12L));
        assertThat(ownerOneSchedules.metadata().get("memberId")).isEqualTo(345L);
        assertThat(ownerOneSchedules.inboxText()).contains("• А", "• Б");

        BusinessNotificationCommand ownerOneCertifications = command(commands, 101L, BusinessNotificationKind.CERTIFICATION);
        assertThat(ownerOneCertifications.metadata().get("resourceIds")).isEqualTo(List.of(21L, 23L));
        assertThat(ownerOneCertifications.inboxText()).doesNotContain("Два");
        assertThat(command(commands, 102L, BusinessNotificationKind.SCHEDULE).metadata().get("resourceIds"))
                .isEqualTo(List.of(13L));
        assertThat(command(commands, 102L, BusinessNotificationKind.CERTIFICATION).metadata().get("resourceIds"))
                .isEqualTo(List.of(31L));
    }

    @Test
    void skipsOwnerlessAndNonMemberOwnersWithoutSuppressingValidResources() {
        when(members.findByRestaurantIdAndUserIdIn(1L, Set.of(20L, 99L))).thenReturn(List.of(ownerOne));

        service.submit(accepted, actor,
                List.of(schedule(1L, "Без владельца", null), schedule(2L, "Ушедший", 99L),
                        schedule(3L, "Рабочий", 20L)), List.of());

        ArgumentCaptor<List<BusinessNotificationCommand>> captor = ArgumentCaptor.forClass(List.class);
        verify(afterCommit).submit(captor.capture());
        assertThat(captor.getValue()).singleElement().satisfies(command ->
                assertThat(command.metadata().get("resourceIds")).isEqualTo(List.of(3L)));
    }

    @Test
    void noEffectiveOwnedResourcesSchedulesNoBatch() {
        service.submit(accepted, actor, List.of(), List.of(
                cert(1L, "Без изменений", 20L, CertificationAudienceEffectType.UNCHANGED)));
        verifyNoInteractions(members, afterCommit);
    }

    private RestaurantMember member(Long memberId, Long userId, String name) {
        return RestaurantMember.builder().id(memberId).restaurant(restaurant)
                .user(User.builder().id(userId).fullName(name).build()).build();
    }

    private AppliedInvitationScheduleEffect schedule(Long id, String title, Long ownerUserId) {
        return new AppliedInvitationScheduleEffect(id, title, ownerUserId);
    }

    private AppliedCertificationAudienceEffect cert(Long id, String title, Long ownerUserId,
                                                     CertificationAudienceEffectType type) {
        return new AppliedCertificationAudienceEffect(id, title, ownerUserId, accepted.getUser().getId(), type);
    }

    private BusinessNotificationCommand command(List<BusinessNotificationCommand> commands, Long recipientMemberId,
                                                BusinessNotificationKind kind) {
        return commands.stream().filter(command -> command.recipient().getId().equals(recipientMemberId)
                        && command.kind() == kind).findFirst().orElseThrow();
    }
}
