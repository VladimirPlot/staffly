package ru.staffly.schedule.model;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.service.ScheduleParticipationCreator;

import java.util.Arrays;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleParticipationTest {

    @Test
    void snapshotsCurrentPositionAtCreation() {
        Position position = Position.builder().id(42L).name("WAITER").build();
        RestaurantMember member = RestaurantMember.builder().position(position).build();
        ScheduleParticipationRepository repository = mock(ScheduleParticipationRepository.class);
        when(repository.findByScheduleIdAndMemberId(any(), any())).thenReturn(Optional.empty());
        when(repository.save(any())).thenAnswer(invocation -> invocation.getArgument(0));
        ScheduleParticipationCreator creator = new ScheduleParticipationCreator(repository);

        ScheduleParticipation participation = creator.createWithLocksHeld(
                Schedule.builder().build(), member, false).participation();

        assertThat(participation.getPositionId()).isEqualTo(42L);
        assertThat(participation.getPositionName()).isEqualTo("WAITER");
    }

    @Test
    void positionSnapshotHasNoPublicMutationApi() {
        assertThat(Arrays.stream(ScheduleParticipation.class.getMethods())
                .map(method -> method.getName()))
                .doesNotContain("setPositionId", "setPositionName");
    }
}
