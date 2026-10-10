package ru.staffly.task.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.inbox.service.InboxMessageService;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.task.dto.TaskAssignRequest;
import ru.staffly.task.model.*;
import ru.staffly.task.repository.*;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;
import java.time.Instant;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:task-board;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TaskBoardPersistenceTest {
    @Autowired EntityManager em;
    @Autowired TaskRepository tasks;
    @Autowired TaskCommentRepository comments;
    @Autowired RestaurantRepository restaurants;
    @Autowired RestaurantMemberRepository members;
    @Autowired PositionRepository positions;
    @Autowired UserRepository users;
    private final InboxMessageService inbox = mock(InboxMessageService.class);

    @Test void personalProgressAndOptimisticVersionSurviveReload() {
        var fixture = fixture();
        var task = em.find(Task.class, fixture.taskId());
        var target = em.find(RestaurantMember.class, fixture.targetId());
        task.setCompletionMode(TaskCompletionMode.EACH);
        task.setAudience(TaskAudience.MEMBERS);
        task.setDueTime(java.time.LocalTime.of(12, 15));
        var time = new RestaurantTimeService(restaurants, java.time.Clock.fixed(Instant.parse("2026-10-10T10:35:00Z"), java.time.ZoneOffset.UTC));
        var service = new TaskBoardService(tasks, members, positions, restaurants, time,
                new RestaurantLifecycleMutex(restaurants), mock(SecurityService.class), inbox);
        service.add(task, target, false);
        service.add(task, task.getSetterMember(), false);
        em.flush();
        long version = task.getVersion();
        Long uid = target.getUser().getId();
        em.clear();
        var result = service.complete(fixture.taskId(), uid, false);
        assertEquals(1, result.completedCount());
        assertEquals("ACTIVE", result.status());
        assertTrue(result.version() > version);
        em.clear();
        var stored = em.find(Task.class, fixture.taskId());
        assertEquals(java.time.LocalTime.of(12, 15), stored.getDueTime());
        assertEquals(2, stored.getParticipants().size());
        assertEquals(1, stored.getParticipants().stream().filter(p -> p.getCompletedAt() != null).count());
        assertEquals(1, stored.getEvents().size());
        long savedVersion = stored.getVersion();
        em.clear();
        var duplicate = service.complete(fixture.taskId(), uid, false);
        assertEquals(savedVersion, duplicate.version());
        assertEquals(1, duplicate.completedCount());
    }

    private record Fixture(Long taskId, Long actorId, Long targetId, long version) {}
    private Fixture fixture() {
        var restaurant = Restaurant.builder().name("Tasks").code("tasks").timezone("UTC").build();
        em.persist(restaurant);
        var manager = Position.builder().restaurant(restaurant).name("Manager").level(RestaurantRole.MANAGER).build();
        var staff = Position.builder().restaurant(restaurant).name("Staff").build();
        em.persist(manager); em.persist(staff);
        var actorUser = User.builder().phone("+70000000001").email("actor@tasks.test").firstName("Manager").lastName("User").passwordHash("test").build();
        var targetUser = User.builder().phone("+70000000002").email("target@tasks.test").firstName("Staff").lastName("User").passwordHash("test").build();
        em.persist(actorUser); em.persist(targetUser);
        var actor = RestaurantMember.builder().restaurant(restaurant).user(actorUser).position(manager).build();
        var target = RestaurantMember.builder().restaurant(restaurant).user(targetUser).position(staff).build();
        em.persist(actor); em.persist(target);
        var task = Task.builder().restaurant(restaurant).title("Orphan").priority(TaskPriority.LOW)
                .status(TaskStatus.ACTIVE).createdBy(actorUser).setterMember(actor).build();
        em.persist(task); em.flush();
        var fixture = new Fixture(task.getId(), actorUser.getId(), target.getId(), task.getVersion());
        em.clear();
        return fixture;
    }
}

