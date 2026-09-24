package ru.staffly.schedule.service.impl;

import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.InOrder;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;
import ru.staffly.common.exception.BadRequestException;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.schedule.dto.StartPreferenceCollectionRequest;
import ru.staffly.schedule.model.PreferenceCollectionMode;
import ru.staffly.schedule.model.Schedule;
import ru.staffly.schedule.model.ScheduleBuildTemplate;
import ru.staffly.schedule.model.ScheduleStatus;
import ru.staffly.schedule.repository.ScheduleBuildTemplateRepository;
import ru.staffly.schedule.repository.ScheduleParticipationRepository;
import ru.staffly.schedule.repository.SchedulePreferenceSubmissionRepository;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.repository.ScheduleShiftRequestRepository;
import ru.staffly.schedule.service.ScheduleAccessService;
import ru.staffly.schedule.service.ScheduleAuditService;
import ru.staffly.schedule.service.ScheduleChangeService;
import ru.staffly.schedule.service.ScheduleParticipationCreator;
import ru.staffly.security.SecurityService;
import ru.staffly.user.repository.UserRepository;

import java.time.Instant;
import java.util.List;
import java.util.Optional;

import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.mockito.Mockito.inOrder;
import static org.mockito.Mockito.when;

@ExtendWith(MockitoExtension.class)
class SchedulePreferenceCollectionLockOrderTest {
    @Mock ScheduleRepository schedules;
    @Mock ScheduleBuildTemplateRepository templates;
    @Mock RestaurantRepository restaurants;
    @Mock PositionRepository positions;
    @Mock ScheduleShiftRequestRepository shiftRequests;
    @Mock SchedulePreferenceSubmissionRepository submissions;
    @Mock ScheduleParticipationRepository participations;
    @Mock ScheduleParticipationCreator participationCreator;
    @Mock RestaurantMemberRepository members;
    @Mock SecurityService security;
    @Mock ScheduleAccessService access;
    @Mock ScheduleAuditService audit;
    @Mock ScheduleChangeService changes;
    @Mock UserRepository users;
    @Mock InboxMessageService inbox;

    @Test
    void collectionStartLocksScheduleBeforeTemplate() {
        ScheduleServiceImpl service = new ScheduleServiceImpl(
                schedules, templates, restaurants, positions, shiftRequests, submissions, participations,
                participationCreator, members, security, access, audit, changes, users, inbox);
        Schedule schedule = Schedule.builder().id(20L).version(3L).status(ScheduleStatus.DRAFT).build();
        ScheduleBuildTemplate inactiveTemplate = ScheduleBuildTemplate.builder()
                .id(10L).isActive(false).build();
        when(schedules.findPositionIdsByIdAndRestaurantId(20L, 1L)).thenReturn(List.of());
        when(schedules.findForUpdateByIdAndRestaurantId(20L, 1L)).thenReturn(Optional.of(schedule));
        when(templates.findForUpdateByIdAndRestaurantId(10L, 1L)).thenReturn(Optional.of(inactiveTemplate));

        StartPreferenceCollectionRequest request = new StartPreferenceCollectionRequest(
                3L, Instant.now().plusSeconds(3600), PreferenceCollectionMode.SHIFT_OPTIONS, 10L);

        assertThatThrownBy(() -> service.startPreferenceCollection(1L, 20L, 7L, request))
                .isInstanceOf(BadRequestException.class)
                .hasMessage("Активный шаблон сборки не найден");

        InOrder order = inOrder(schedules, templates);
        order.verify(schedules).findForUpdateByIdAndRestaurantId(20L, 1L);
        order.verify(templates).findForUpdateByIdAndRestaurantId(10L, 1L);
    }
}
