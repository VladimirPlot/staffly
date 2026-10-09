package ru.staffly.invite;

import jakarta.persistence.EntityManager;
import org.hibernate.SessionFactory;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.ValueSource;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.common.time.TimeProvider;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.invite.controller.InvitationAcceptanceController;
import ru.staffly.invite.dto.MyInviteDto;
import ru.staffly.invite.exception.InvitationInvalidatedException;
import ru.staffly.invite.mapper.InvitationMapper;
import ru.staffly.invite.model.*;
import ru.staffly.invite.repository.InvitationRepository;
import ru.staffly.invite.service.*;
import ru.staffly.member.lifecycle.AdmissionCoordinator;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.mapper.MemberMapper;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.member.service.EmployeeService;
import ru.staffly.restaurant.model.*;
import ru.staffly.security.UserPrincipal;
import ru.staffly.user.model.User;
import ru.staffly.user.repository.UserRepository;

import java.math.BigDecimal;
import java.time.Instant;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

/** Real Hibernate JSON persistence, repository query, /my controller and admission validation.
 * H2 PostgreSQL mode follows the existing persistence-test setup; it does not test PostgreSQL locks. */
@DataJpaTest(properties = {
        "spring.flyway.enabled=false",
        "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.jpa.database-platform=org.hibernate.dialect.H2Dialect",
        "spring.jpa.properties.hibernate.generate_statistics=true",
        "spring.datasource.url=jdbc:h2:mem:invitation-read;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class InvitationReadModelPersistenceTest {
    @Autowired EntityManager em;
    @Autowired InvitationRepository invitations;
    @Autowired PositionRepository positions;
    @Autowired RestaurantMemberRepository members;
    @Autowired UserRepository users;
    Restaurant restaurant;
    Position position;
    User user;
    Instant now;
    Invitation invitation;
    AdmissionPositionSnapshot issuedSnapshot;

    @BeforeEach void createIssuedInvitation() {
        now = TimeProvider.now();
        restaurant = Restaurant.builder().name("Restaurant").code("invite-regression").timezone("UTC").build();
        em.persist(restaurant);
        position = Position.builder().restaurant(restaurant).name("Официант").payRate(new BigDecimal("300.00")).build();
        em.persist(position);
        user = User.builder().phone("+79999999999").email("employee@example.com")
                .firstName("Test").lastName("Employee").passwordHash("test").build();
        em.persist(user);
        invitation = saveInvitation("issued", InvitationStatus.PENDING, now.plusSeconds(3600), user.getPhone());
        issuedSnapshot = invitation.getPositionSnapshot();
        reload();
    }

    private Invitation saveInvitation(String token, InvitationStatus status, Instant expiresAt, String contact) {
        return invitations.save(Invitation.builder().restaurant(restaurant).position(position)
                .positionSnapshot(AdmissionPositionSnapshot.of(position)).desiredRole(position.getLevel())
                .token(token).phoneOrEmail(contact).status(status).expiresAt(expiresAt).build());
    }

    private void reload() {
        em.flush();
        em.clear();
        invitation = invitations.findByToken("issued").orElseThrow();
        position = em.find(Position.class, position.getId());
        restaurant = em.find(Restaurant.class, restaurant.getId());
    }

    private List<MyInviteDto> myInvites() {
        return new InvitationAcceptanceController(mock(EmployeeService.class), invitations, users,
                mock(InvitationSenderNotificationService.class))
                .myInvites(new UserPrincipal(user.getId(), user.getPhone(), null, List.of()));
    }

    private AdmissionCoordinator admission() {
        var time = mock(RestaurantTimeService.class);
        when(time.nowInstant()).thenReturn(now);
        return new AdmissionCoordinator(List.of(), mock(RestaurantLifecycleMutex.class),
                mock(InvitationContactLock.class), invitations, positions, members, users,
                new MemberMapper(), time, mock(InvitationSenderNotificationService.class),
                mock(InvitationAcceptanceOwnerNotificationService.class));
    }

    @ParameterizedTest
    @ValueSource(strings = {"name", "level", "payType", "payRate", "normHours"})
    void liveEditsPreserveIssuedDisplayButInvalidateAcceptance(String field) {
        switch (field) {
            case "name" -> position.setName("Старший официант");
            case "level" -> position.setLevel(RestaurantRole.ADMIN);
            case "payType" -> position.setPayType(ru.staffly.master_schedule.model.PayType.SALARY);
            case "payRate" -> position.setPayRate(new BigDecimal("500.00"));
            case "normHours" -> position.setNormHours(160);
        }
        reload();
        var dto = myInvites().get(0);
        assertEquals("Официант", dto.positionName());
        assertEquals(issuedSnapshot.positionId(), dto.positionId());
        assertEquals(RestaurantRole.STAFF, dto.desiredRole());
        assertEquals(issuedSnapshot, invitation.getPositionSnapshot());
        assertEquals(issuedSnapshot.positionId(), new InvitationMapper().toResponse(invitation).positionId());
        var ex = assertThrows(InvitationInvalidatedException.class,
                () -> admission().acceptInvite("issued", user.getId()));
        assertEquals("INVITATION_INVALIDATED", ex.getMeta().get("code"));
        assertEquals("POSITION_CHANGED", ex.getMeta().get("reason"));
        reload();
        assertEquals(InvitationStatus.INVALIDATED, invitation.getStatus());
        assertEquals(issuedSnapshot, invitation.getPositionSnapshot());
        assertEquals(0, members.count());
        assertTrue(myInvites().isEmpty());
    }

    @Test void unchangedPositionDisplaysSnapshotAndAcceptsExactlyOnce() {
        assertEquals("Официант", myInvites().get(0).positionName());
        var coordinator = admission();
        var member = coordinator.acceptInvite("issued", user.getId());
        assertEquals(member.id(), coordinator.acceptInvite("issued", user.getId()).id());
        reload();
        assertEquals(InvitationStatus.ACCEPTED, invitation.getStatus());
        assertEquals(issuedSnapshot, invitation.getPositionSnapshot());
        assertEquals(1, members.count());
        assertTrue(myInvites().isEmpty());
    }

    @Test void onlyUnexpiredPendingMatchingContactsAreReturnedInExpiryOrderWithoutNPlusOne() {
        for (var status : InvitationStatus.values()) {
            if (status != InvitationStatus.PENDING) saveInvitation(status.name(), status, now.plusSeconds(7200), user.getPhone());
        }
        saveInvitation("expired-pending", InvitationStatus.PENDING, now.minusSeconds(1), user.getPhone());
        saveInvitation("other-contact", InvitationStatus.PENDING, now.plusSeconds(3600), "+78888888888");
        saveInvitation("email", InvitationStatus.PENDING, now.plusSeconds(1800), "EMPLOYEE@EXAMPLE.COM");
        em.flush();
        em.clear();
        var stats = em.getEntityManagerFactory().unwrap(SessionFactory.class).getStatistics();
        stats.clear();
        assertEquals(List.of("email", "issued"), myInvites().stream().map(MyInviteDto::token).toList());
        assertEquals(2, stats.getPrepareStatementCount(), "user lookup + one invitation/restaurant fetch; no Position fetch");
        assertEquals(0, members.count());
    }

    @Test void corruptPendingSnapshotFailsClosedAndLegacyTerminalIdentityIsUnknown() {
        // H2 schema generation omits V119's CHECK, allowing us to exercise the corruption guard.
        em.createNativeQuery("update invitation set position_snapshot = null where token = 'issued'").executeUpdate();
        em.clear();
        var error = assertThrows(org.springframework.dao.InvalidDataAccessApiUsageException.class, this::myInvites);
        assertInstanceOf(IllegalStateException.class, error.getCause());
        var legacy = invitations.findByToken("issued").orElseThrow();
        legacy.setStatus(InvitationStatus.INVALIDATED);
        em.flush();
        assertNull(new InvitationMapper().toResponse(legacy).positionId());
        assertTrue(myInvites().isEmpty());
        assertEquals(0, members.count());
    }

    @Test void issuedIdentityDoesNotFollowLiveAssociationAndSnapshotCannotBeUpdated() {
        var other = Position.builder().restaurant(restaurant).name("Other position").build();
        em.persist(other);
        invitation.setPosition(other);
        reload();
        assertEquals(issuedSnapshot.positionId(), myInvites().get(0).positionId());
        assertEquals(issuedSnapshot.positionId(), new InvitationMapper().toResponse(invitation).positionId());
        invitation.setPositionSnapshot(AdmissionPositionSnapshot.of(other));
        reload();
        assertEquals(issuedSnapshot, invitation.getPositionSnapshot(), "updatable=false preserves issued JSON");
        assertEquals(0, members.count());
    }
}
