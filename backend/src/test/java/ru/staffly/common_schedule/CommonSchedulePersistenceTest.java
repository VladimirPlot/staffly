package ru.staffly.common_schedule;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import ru.staffly.common_schedule.dto.CommonScheduleRequest;
import ru.staffly.common_schedule.model.CommonSchedule;
import ru.staffly.common_schedule.repository.CommonScheduleRepository;
import ru.staffly.common_schedule.service.*;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.schedule.model.*;
import ru.staffly.schedule.repository.ScheduleRepository;
import ru.staffly.schedule.service.*;
import ru.staffly.security.SecurityService;

import java.time.LocalDate;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:common-schedule;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({CommonScheduleService.class, CommonScheduleDependencies.class, ScheduleContentMapper.class,
        RestaurantLifecycleMutex.class})
class CommonSchedulePersistenceTest {
    @Autowired EntityManager em;
    @Autowired CommonScheduleService service;
    @Autowired CommonScheduleRepository commonSchedules;
    @Autowired ScheduleRepository schedules;
    @Autowired CommonScheduleDependencies dependencies;
    @MockBean SecurityService security;
    @MockBean ScheduleAccessService access;

    Restaurant restaurant() {
        var restaurant = Restaurant.builder().name("Fixture").code("common-schedule-test").timezone("Europe/Moscow").build();
        em.persist(restaurant);
        when(access.canManageSchedules(7L, restaurant.getId())).thenReturn(true);
        return restaurant;
    }

    Schedule source(Restaurant restaurant, String title) {
        var source = Schedule.builder().restaurant(restaurant).title(title).status(ScheduleStatus.PUBLISHED)
                .startDate(LocalDate.of(2026, 10, 1)).endDate(LocalDate.of(2026, 10, 31))
                .shiftMode(ScheduleShiftMode.FULL).build();
        em.persist(source);
        return source;
    }

    @Test void savesReordersAndDeletesOnlyReferencesWithVersionProtection() {
        var restaurant = restaurant();
        var a = source(restaurant, "Бар"); var b = source(restaurant, "Зал"); var c = source(restaurant, "Хостес");
        var ids = List.of(a.getId(), b.getId(), c.getId());
        em.flush();
        var created = service.create(restaurant.getId(), 7L, new CommonScheduleRequest("Общий", ids, false, null));
        var id = created.summary().id();
        assertEquals(ids, created.summary().scheduleIds());
        em.clear();
        assertEquals(ids, service.get(restaurant.getId(), id, 7L).summary().scheduleIds());
        var reordered = List.of(c.getId(), a.getId(), b.getId());
        var updated = service.update(restaurant.getId(), id, 7L,
                new CommonScheduleRequest("Общий", reordered, true, created.summary().version()));
        assertTrue(updated.summary().version() > created.summary().version());
        em.clear();
        assertEquals(reordered, service.get(restaurant.getId(), id, 7L).summary().scheduleIds());
        assertEquals(1, commonSchedules.findDependingOn(a.getId()).size());
        assertThrows(ru.staffly.common.exception.ConflictException.class, () -> dependencies.assertCanDelete(a.getId()));
        service.delete(restaurant.getId(), id, 7L, updated.summary().version());
        em.flush(); em.clear();
        assertTrue(commonSchedules.findById(id).isEmpty());
        assertEquals(3, schedules.count());
        assertTrue(commonSchedules.findDependingOn(a.getId()).isEmpty());
    }

    @Test void reloadReflectsSourceEditsAndRetainedHistoryWithoutCopyingCells() {
        var restaurant = restaurant();
        var a = source(restaurant, "Бар"); var b = source(restaurant, "Зал");
        var row = ScheduleRow.builder().schedule(a).memberId(42L).historical(true)
                .displayName("Анна").positionName("Бармен").sortOrder(0).build();
        var cell = ScheduleCell.builder().row(row).day(a.getStartDate()).value("09:00-17:00").build();
        row.getCells().add(cell); a.getRows().add(row);
        em.flush();
        var created = service.create(restaurant.getId(), 7L,
                new CommonScheduleRequest("Общий", List.of(a.getId(), b.getId()), false, null));
        String key = "-" + row.getId() + ":2026-10-01";
        assertEquals("09:00-17:00", created.sources().get(0).content().cellValues().get(key));
        cell.setValue("10:00-18:00");
        em.flush(); em.clear();
        var reloaded = service.get(restaurant.getId(), created.summary().id(), 7L);
        assertEquals("10:00-18:00", reloaded.sources().get(0).content().cellValues().get(key));
        assertTrue(reloaded.sources().get(0).content().rows().get(0).historical());
        assertEquals(1L, ((Number) em.createNativeQuery("select count(*) from schedule_cell").getSingleResult()).longValue());
        assertNotNull(em.find(CommonSchedule.class, created.summary().id()));
    }
}
