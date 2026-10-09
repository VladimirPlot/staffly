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
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.datasource.url=jdbc:h2:mem:task-assignment;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class TaskAssignmentPersistenceTest {
    @Autowired EntityManager em;
    @Autowired TaskRepository tasks;
    @Autowired TaskCommentRepository comments;
    @Autowired RestaurantRepository restaurants;
    @Autowired RestaurantMemberRepository members;
    @Autowired PositionRepository positions;
    @Autowired UserRepository users;
    private final InboxMessageService inbox = mock(InboxMessageService.class);

    private TaskService service() {
        return new TaskService(tasks, comments, restaurants, members, positions, users, inbox,
                mock(RestaurantTimeService.class), mock(SecurityService.class), new RestaurantLifecycleMutex(restaurants));
    }

    @Test void realVersionAdvancesAndDuplicateSubmitCannotOverwriteAssignment() {
        var fixture = fixture();
        var request = new TaskAssignRequest(fixture.targetId(), fixture.version());
        var service = service();
        var updated = service.assign(fixture.taskId(), fixture.actorId(), request);
        assertTrue(updated.version() > fixture.version());
        em.clear();
        var stored = em.find(Task.class, fixture.taskId());
        assertEquals(fixture.targetId(), stored.getAssignedMember().getId());
        assertEquals(stored.getAssignedMember().getUser().getId(), stored.getAssignedUser().getId());
        assertEquals(fixture.actorId(), stored.getSetterMember().getUser().getId());
        assertEquals(fixture.actorId(), stored.getCreatedBy().getId());
        em.clear();
        assertThrows(ConflictException.class, () -> service.assign(fixture.taskId(), fixture.actorId(), request));
        verify(inbox, times(1)).createEvent(any(), any(), any(), any(), any(), any(), any());
    }

    @Test void endedMemberIdDoesNotResolveToTheRehiredEmploymentPeriod() {
        var fixture = fixture();
        var old = em.find(RestaurantMember.class, fixture.targetId());
        old.setEndedAt(Instant.now());
        var rehired = RestaurantMember.builder().restaurant(old.getRestaurant()).user(old.getUser())
                .position(old.getPosition()).build();
        em.persist(rehired);
        em.flush();
        em.clear();
        assertThrows(BadRequestException.class, () -> service().assign(fixture.taskId(), fixture.actorId(),
                new TaskAssignRequest(fixture.targetId(), fixture.version())));
        assertNull(em.find(Task.class, fixture.taskId()).getAssignedMember());
        verifyNoInteractions(inbox);
    }

    @Test void sameUserInAnotherRestaurantCannotBeSelectedThroughThatMemberId() {
        var fixture = fixture();
        var local = em.find(RestaurantMember.class, fixture.targetId());
        var other = Restaurant.builder().name("Other").code("other").timezone("UTC").build();
        em.persist(other);
        var position = Position.builder().restaurant(other).name("Other Staff").build();
        em.persist(position);
        var foreign = RestaurantMember.builder().restaurant(other).user(local.getUser()).position(position).build();
        em.persist(foreign); em.flush();
        Long foreignId = foreign.getId();
        em.clear();
        assertThrows(BadRequestException.class, () -> service().assign(fixture.taskId(), fixture.actorId(),
                new TaskAssignRequest(foreignId, fixture.version())));
        assertNull(em.find(Task.class, fixture.taskId()).getAssignedMember());
        verifyNoInteractions(inbox);
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
