package ru.staffly.reminder;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import ru.staffly.dictionary.model.Position;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.reminder.mapper.ReminderMapper;
import ru.staffly.reminder.model.*;
import ru.staffly.reminder.repository.ReminderRepository;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.user.model.User;

import java.time.Instant;
import java.time.LocalTime;
import java.util.LinkedHashSet;
import java.util.List;
import static org.junit.jupiter.api.Assertions.*;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:reminders;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ReminderAudiencePersistenceTest {
    @Autowired EntityManager em;
    @Autowired ReminderRepository reminders;
    Restaurant restaurant;
    RestaurantMember first;
    RestaurantMember second;
    Position firstPosition;
    Position secondPosition;
    final Instant now = Instant.parse("2026-10-10T12:00:00Z");

    @BeforeEach void setup() {
        restaurant = Restaurant.builder().name("Restaurant").code("reminder-test").timezone("UTC").build();
        em.persist(restaurant);
        firstPosition = Position.builder().restaurant(restaurant).name("Waiter").build();
        secondPosition = Position.builder().restaurant(restaurant).name("Cook").build();
        em.persist(firstPosition); em.persist(secondPosition);
        first = member("+79999999991", firstPosition);
        second = member("+79999999992", secondPosition);
    }

    private RestaurantMember member(String phone, Position position) {
        User user = User.builder().phone(phone).email(phone.substring(1) + "@reminder.test")
                .firstName("Test").lastName(phone).passwordHash("test").build();
        em.persist(user);
        var member = RestaurantMember.builder().restaurant(restaurant).user(user).position(position).build();
        em.persist(member);
        return member;
    }

    private Reminder reminder(ReminderTargetType type) {
        return Reminder.builder().restaurant(restaurant).createdByMember(first).title("Test")
                .targetType(type).periodicity(ReminderPeriodicity.DAILY).time(LocalTime.of(9, 0))
                .active(true).nextFireAt(now).build();
    }

    @Test void multiplePersonalTargetsSurviveReloadAndOnlyLastTerminationDisablesReminder() {
        var reminder = reminder(ReminderTargetType.MEMBER);
        reminder.setTargetMembers(new LinkedHashSet<>(List.of(first, second)));
        reminders.saveAndFlush(reminder);
        Long id = reminder.getId(), restaurantId = restaurant.getId(), firstId = first.getId(), secondId = second.getId();
        em.clear();
        assertEquals(1, reminders.countByTargetMemberId(firstId));
        assertEquals(2, new ReminderMapper().toDto(reminders.findDetailedByRestaurantId(restaurantId).get(0)).targetMembers().size());
        assertEquals(1, reminders.detachPersonalTarget(firstId, now));
        em.flush(); em.clear();
        var remaining = reminders.findById(id).orElseThrow();
        assertTrue(remaining.isActive());
        assertEquals(now, remaining.getNextFireAt());
        assertEquals(List.of(secondId), remaining.effectiveMembers().stream().map(RestaurantMember::getId).toList());
        assertEquals(1, reminders.detachPersonalTarget(secondId, now));
        em.flush(); em.clear();
        var detached = reminders.findById(id).orElseThrow();
        assertFalse(detached.isActive());
        assertNull(detached.getNextFireAt());
        assertTrue(detached.effectiveMembers().isEmpty());
    }

    @Test void privateLegacySelfReminderDetachesAndDoesNotBecomeVisibleAfterTermination() {
        var reminder = reminder(ReminderTargetType.MEMBER);
        reminder.setTargetMember(first);
        reminder.setVisibleToAdmin(false);
        reminders.saveAndFlush(reminder);
        Long id = reminder.getId(), memberId = first.getId();
        em.clear();
        assertEquals(1, reminders.detachPersonalTarget(memberId, now));
        em.flush(); em.clear();
        var detached = reminders.findById(id).orElseThrow();
        assertFalse(detached.isActive());
        assertFalse(detached.isVisibleToAdmin());
        assertNull(detached.getTargetMember());
        assertNull(detached.getNextFireAt());
    }

    @Test void positionChangeKeepsPersonalTargetsAndMultiplePositionAudience() {
        var personal = reminder(ReminderTargetType.MEMBER);
        personal.setTargetMembers(new LinkedHashSet<>(List.of(first)));
        var positionReminder = reminder(ReminderTargetType.POSITION);
        positionReminder.setTargetPositions(new LinkedHashSet<>(List.of(firstPosition, secondPosition)));
        reminders.save(personal); reminders.save(positionReminder);
        first.setPosition(secondPosition);
        em.flush();
        Long personalId = personal.getId(), positionId = positionReminder.getId(), newPositionId = secondPosition.getId();
        em.clear();
        var persisted = reminders.findById(personalId).orElseThrow();
        assertTrue(persisted.isActive());
        assertFalse(persisted.isVisibleToAdmin());
        assertEquals(newPositionId, persisted.effectiveMembers().iterator().next().getPosition().getId());
        assertEquals(2, reminders.findById(positionId).orElseThrow().effectivePositions().size());
    }
}
