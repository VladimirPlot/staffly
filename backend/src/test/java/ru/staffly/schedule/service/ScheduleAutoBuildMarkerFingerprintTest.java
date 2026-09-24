package ru.staffly.schedule.service;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.user.model.User;

import java.time.DayOfWeek;
import java.time.LocalDate;
import java.time.LocalTime;
import java.util.ArrayList;
import java.util.LinkedHashSet;
import java.util.List;

import static org.assertj.core.api.Assertions.assertThat;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

class ScheduleAutoBuildMarkerFingerprintTest {
    private static final long SCHEDULE_ID = 40L;
    private static final Position WAITER = Position.builder().id(10L).name("Waiter").build();
    private static final Position SENIOR_WAITER = Position.builder().id(11L).name("Senior waiter").build();
    private static final Position COOK = Position.builder().id(20L).name("Cook").build();

    private ScheduleParticipationRepository participations;
    private ScheduleAutoBuildFingerprintService fingerprints;

    @BeforeEach
    void setUp() {
        SchedulePreferenceSubmissionRepository submissions = mock(SchedulePreferenceSubmissionRepository.class);
        participations = mock(ScheduleParticipationRepository.class);
        fingerprints = new ScheduleAutoBuildFingerprintService(submissions, participations);
        when(submissions.findWithCellsByScheduleId(SCHEDULE_ID)).thenReturn(List.of());
    }

    @Test
    void markerRenameDoesNotChangeFingerprint() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, WAITER, WAITER));
        fixture.marker().getMembers().add(fixture.member(100L));
        fixture.shift().setMarker(fixture.marker());
        String before = fingerprint(fixture);

        fixture.marker().setName("Night club");

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void markerPersistenceIdRecreationDoesNotChangeFingerprint() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, WAITER, WAITER));
        fixture.marker().getMembers().add(fixture.member(100L));
        fixture.shift().setMarker(fixture.marker());
        String before = fingerprint(fixture);

        fixture.marker().setId(999L);

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void attachingAndDetachingMarkerChangeFingerprint() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, WAITER, WAITER));
        fixture.marker().getMembers().add(fixture.member(100L));
        String detached = fingerprint(fixture);

        fixture.shift().setMarker(fixture.marker());
        String attached = fingerprint(fixture);
        fixture.shift().setMarker(null);

        assertThat(attached).isNotEqualTo(detached);
        assertThat(fingerprint(fixture)).isEqualTo(detached);
    }

    @Test
    void relevantMembershipChangeChangesFingerprintAndMemberOrderDoesNot() {
        Fixture fixture = fixture(List.of(WAITER),
                candidate(100L, WAITER, WAITER), candidate(101L, WAITER, WAITER));
        fixture.shift().setMarker(fixture.marker());
        fixture.marker().setMembers(new LinkedHashSet<>(List.of(fixture.member(100L))));
        String member100 = fingerprint(fixture);

        fixture.marker().setMembers(new LinkedHashSet<>(List.of(fixture.member(101L))));
        assertThat(fingerprint(fixture)).isNotEqualTo(member100);

        fixture.marker().setMembers(new LinkedHashSet<>(List.of(fixture.member(100L), fixture.member(101L))));
        String ordered = fingerprint(fixture);
        fixture.marker().setMembers(new LinkedHashSet<>(List.of(fixture.member(101L), fixture.member(100L))));
        assertThat(fingerprint(fixture)).isEqualTo(ordered);
    }

    @Test
    void nonCandidateMembershipDoesNotChangeFingerprint() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, WAITER, WAITER));
        fixture.shift().setMarker(fixture.marker());
        fixture.marker().getMembers().add(fixture.member(100L));
        String before = fingerprint(fixture);

        fixture.marker().getMembers().add(member(999L, WAITER));

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void currentPositionOutsideBlockRemovesEffectiveAffinity() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, WAITER, WAITER));
        fixture.marker().getMembers().add(fixture.member(100L));
        fixture.shift().setMarker(fixture.marker());
        String eligible = fingerprint(fixture);

        fixture.member(100L).setPosition(COOK);

        assertThat(fingerprint(fixture)).isNotEqualTo(eligible);
    }

    @Test
    void currentPositionChangeInsideSameBlockKeepsEffectiveAffinity() {
        Fixture fixture = fixture(List.of(WAITER, SENIOR_WAITER), candidate(100L, WAITER, WAITER));
        fixture.marker().getMembers().add(fixture.member(100L));
        fixture.shift().setMarker(fixture.marker());
        String before = fingerprint(fixture);

        fixture.member(100L).setPosition(SENIOR_WAITER);

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    @Test
    void participationPositionOutsideBlockStillExcludesCurrentEligibleMember() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, COOK, WAITER));
        fixture.shift().setMarker(fixture.marker());
        String empty = fingerprint(fixture);

        fixture.marker().getMembers().add(fixture.member(100L));

        assertThat(fingerprint(fixture)).isEqualTo(empty);
    }

    @Test
    void attachedEmptyMarkerDiffersFromNoMarker() {
        Fixture fixture = fixture(List.of(WAITER));
        String detached = fingerprint(fixture);

        fixture.shift().setMarker(fixture.marker());

        assertThat(fingerprint(fixture)).isNotEqualTo(detached);
    }

    @Test
    void markerCollectionOrderAndSharedShiftIterationOrderAreDeterministic() {
        Fixture fixture = fixture(List.of(WAITER), candidate(100L, WAITER, WAITER));
        fixture.marker().getMembers().add(fixture.member(100L));
        fixture.shift().setMarker(fixture.marker());
        ScheduleBuildMarker unused = marker(43L, "Unused", fixture.config());
        fixture.config().getMarkers().add(unused);
        ScheduleBuildShiftOption second = shift(fixture.regime(), 22L, 17, 0, 1);
        second.setMarker(fixture.marker());
        fixture.regime().getShiftOptions().add(second);
        String before = fingerprint(fixture);

        java.util.Collections.reverse(fixture.config().getMarkers());
        java.util.Collections.reverse(fixture.regime().getShiftOptions());

        assertThat(fingerprint(fixture)).isEqualTo(before);
    }

    private String fingerprint(Fixture fixture) {
        when(participations.findByScheduleIdOrderById(SCHEDULE_ID)).thenReturn(fixture.participations());
        return fingerprints.fingerprint(1L, fixture.schedule(), fixture.template());
    }

    private Fixture fixture(List<Position> blockPositions, Candidate... candidates) {
        Schedule schedule = Schedule.builder().id(SCHEDULE_ID).version(1L)
                .startDate(LocalDate.of(2026, 1, 1)).endDate(LocalDate.of(2026, 1, 7))
                .status(ScheduleStatus.PREFERENCES_CLOSED).shiftMode(ScheduleShiftMode.FULL)
                .positions(new LinkedHashSet<>(blockPositions)).rows(new ArrayList<>()).build();
        ScheduleBuildTemplate template = ScheduleBuildTemplate.builder().id(60L).name("Template")
                .positionConfigs(new ArrayList<>()).build();
        ScheduleBuildPositionConfig config = ScheduleBuildPositionConfig.builder().id(15L).template(template)
                .positions(new LinkedHashSet<>(blockPositions)).targetPattern(ScheduleBuildPattern.NONE)
                .minRestMode(ScheduleBuildMinRestMode.SOFT).heavyDaysOfWeek(new ArrayList<>()).sortOrder(0).build();
        ScheduleBuildWeekdayRegime regime = ScheduleBuildWeekdayRegime.builder().id(16L).positionConfig(config)
                .daysOfWeek(new LinkedHashSet<>(List.of(DayOfWeek.values())))
                .workPeriodStart(LocalTime.of(9, 0)).workPeriodEnd(LocalTime.of(23, 0)).sortOrder(0).build();
        ScheduleBuildShiftOption shift = shift(regime, 21L, 9, 17, 0);
        ScheduleBuildMarker marker = marker(42L, "Club", config);
        regime.getShiftOptions().add(shift);
        config.getWeekdayRegimes().add(regime);
        config.getMarkers().add(marker);
        template.getPositionConfigs().add(config);

        List<ScheduleParticipation> participationEntities = new ArrayList<>();
        for (Candidate candidate : candidates) {
            RestaurantMember member = member(candidate.memberId(), candidate.currentPosition());
            participationEntities.add(ScheduleParticipation.builder().id(candidate.memberId()).schedule(schedule)
                    .member(member).positionId(candidate.participationPosition().getId())
                    .positionName(candidate.participationPosition().getName()).build());
        }
        return new Fixture(schedule, template, config, regime, shift, marker, participationEntities);
    }

    private ScheduleBuildShiftOption shift(ScheduleBuildWeekdayRegime regime, long id,
                                            int startHour, int endHour, int order) {
        return ScheduleBuildShiftOption.builder().id(id).weekdayRegime(regime)
                .startTime(LocalTime.of(startHour, 0)).endTime(LocalTime.of(endHour, 0)).sortOrder(order).build();
    }

    private ScheduleBuildMarker marker(long id, String name, ScheduleBuildPositionConfig config) {
        return ScheduleBuildMarker.builder().id(id).name(name).positionConfig(config).build();
    }

    private RestaurantMember member(long id, Position position) {
        return RestaurantMember.builder().id(id).user(User.builder().id(id).build()).position(position).build();
    }

    private Candidate candidate(long memberId, Position participationPosition, Position currentPosition) {
        return new Candidate(memberId, participationPosition, currentPosition);
    }

    private record Candidate(long memberId, Position participationPosition, Position currentPosition) {}

    private record Fixture(Schedule schedule, ScheduleBuildTemplate template, ScheduleBuildPositionConfig config,
                           ScheduleBuildWeekdayRegime regime, ScheduleBuildShiftOption shift,
                           ScheduleBuildMarker marker, List<ScheduleParticipation> participations) {
        RestaurantMember member(long memberId) {
            return participations.stream().map(ScheduleParticipation::getMember)
                    .filter(member -> member.getId().equals(memberId)).findFirst().orElseThrow();
        }
    }
}
