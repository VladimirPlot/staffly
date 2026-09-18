package ru.staffly.schedule.model;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.service.ScheduleParticipationService;

import java.util.Arrays;

import static org.assertj.core.api.Assertions.assertThat;

class ScheduleParticipationTest {

    @Test
    void snapshotsCurrentPositionAtCreation() {
        Position position = Position.builder().id(42L).name("WAITER").build();
        RestaurantMember member = RestaurantMember.builder().position(position).build();

        ScheduleParticipation participation = ScheduleParticipationService.newParticipation(
                Schedule.builder().build(), member);

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
