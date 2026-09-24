package ru.staffly.schedule.service;

import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.dto.*;
import ru.staffly.schedule.model.*;

import java.time.DayOfWeek;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static ru.staffly.schedule.service.ScheduleBuildTemplateChangeImpact.*;

class ScheduleBuildTemplateMarkerClassifierTest {
    private final ScheduleBuildTemplateChangeClassifier classifier = new ScheduleBuildTemplateChangeClassifier();

    @Test
    void persistenceIdsAreExcludedFromSemanticClassification() {
        ScheduleBuildTemplate current = template("Клуб", 100L);

        assertThat(classifier.classify(current, request(999L, 777L, List.of(10L), "Клуб", 100L)))
                .isEqualTo(NONE);
    }

    @Test
    void markerRenameAndMembershipRemainNeutralMetadata() {
        ScheduleBuildTemplate current = template("Клуб", 100L);

        assertThat(classifier.classify(current, request(15L, 42L, List.of(10L), "Ночной клуб", 100L)))
                .isEqualTo(NEUTRAL_METADATA);
        assertThat(classifier.classify(current, request(15L, 42L, List.of(10L), "Клуб", 100L, 101L)))
                .isEqualTo(NEUTRAL_METADATA);
    }

    @Test
    void stablePositionConfigIdDoesNotHidePositionScopeChange() {
        ScheduleBuildTemplate current = template("Клуб", 100L);

        assertThat(classifier.classify(current, request(15L, 42L, List.of(11L), "Клуб", 100L)))
                .isEqualTo(PREFERENCE_AFFECTING);
    }

    private ScheduleBuildTemplate template(String markerName, Long... memberIds) {
        Position waiter = Position.builder().id(10L).name("Waiter").build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(15L)
                .positions(new LinkedHashSet<>(List.of(waiter))).targetPattern(ScheduleBuildPattern.NONE)
                .minRestHours(12).minRestMode(ScheduleBuildMinRestMode.SOFT).maxShiftsPerPeriod(5)
                .sortOrder(0).build();
        ScheduleBuildWeekdayRegime regime = ScheduleBuildWeekdayRegime.builder()
                .positionConfig(config).daysOfWeek(new LinkedHashSet<>(List.of(DayOfWeek.values())))
                .workPeriodStart(LocalTime.of(9, 0)).workPeriodEnd(LocalTime.of(17, 0)).sortOrder(0).build();
        ScheduleBuildShiftOption shift = ScheduleBuildShiftOption.builder().weekdayRegime(regime)
                .startTime(LocalTime.of(9, 0)).endTime(LocalTime.of(17, 0)).sortOrder(0).build();
        regime.getShiftOptions().add(shift);
        config.getWeekdayRegimes().add(regime);
        ScheduleBuildMarker marker = ScheduleBuildMarker.builder().id(42L).positionConfig(config).name(markerName).build();
        for (Long memberId : memberIds) marker.getMembers().add(RestaurantMember.builder().id(memberId).build());
        config.getMarkers().add(marker);
        return ScheduleBuildTemplate.builder().id(1L).name("Template").isActive(true)
                .positionConfigs(new ArrayList<>(List.of(config))).build();
    }

    private SaveScheduleBuildTemplateRequest request(Long configId, Long markerId, List<Long> positionIds,
                                                     String markerName, Long... memberIds) {
        SaveScheduleBuildShiftOptionRequest shift = new SaveScheduleBuildShiftOptionRequest(
                LocalTime.of(9, 0), LocalTime.of(17, 0), null, 0);
        SaveScheduleBuildWeekdayRegimeRequest regime = new SaveScheduleBuildWeekdayRegimeRequest(
                List.of(DayOfWeek.values()), LocalTime.of(9, 0), LocalTime.of(17, 0),
                List.of(shift), List.of(), List.of(), 0);
        SaveScheduleBuildMarkerRequest marker = new SaveScheduleBuildMarkerRequest(markerId, markerName, List.of(memberIds));
        SaveScheduleBuildPositionConfigRequest config = new SaveScheduleBuildPositionConfigRequest(configId,
                positionIds, ScheduleBuildPattern.NONE, 12, ScheduleBuildMinRestMode.SOFT, 5,
                List.of(), List.of(regime), List.of(marker), 0);
        return new SaveScheduleBuildTemplateRequest("Template", null, true, List.of(config));
    }
}
