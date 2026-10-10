package ru.staffly.checklist.service;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.mock.web.MockMultipartFile;
import ru.staffly.checklist.dto.*;
import ru.staffly.checklist.mapper.*;
import ru.staffly.checklist.model.*;
import ru.staffly.checklist.repository.*;
import ru.staffly.common.exception.*;
import ru.staffly.common.time.RestaurantTimeService;
import ru.staffly.dictionary.model.Position;
import ru.staffly.dictionary.repository.PositionRepository;
import ru.staffly.media.ChecklistImageStorage;
import ru.staffly.member.lifecycle.RestaurantLifecycleMutex;
import ru.staffly.member.model.RestaurantMember;
import ru.staffly.member.repository.RestaurantMemberRepository;
import ru.staffly.restaurant.model.*;
import ru.staffly.restaurant.repository.RestaurantRepository;
import ru.staffly.security.SecurityService;
import ru.staffly.user.model.User;
import java.time.*;
import java.util.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:checklist;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
class ChecklistPersistenceTest {
    @Autowired EntityManager em;
    @Autowired ChecklistRepository checklists;
    @Autowired ChecklistHistoryRepository histories;
    @Autowired RestaurantRepository restaurants;
    @Autowired PositionRepository positions;
    @Autowired RestaurantMemberRepository members;
    private final ChecklistImageStorage storage = mock(ChecklistImageStorage.class);
    private final SecurityService security = mock(SecurityService.class);
    private static final Instant START = Instant.parse("2026-10-10T09:00:00Z");

    private record Fixture(Restaurant restaurant, Position position, User user, RestaurantMember member) {}
    private Fixture fixture() {
        Restaurant restaurant = Restaurant.builder().name("Checklists").code(UUID.randomUUID().toString()).timezone("UTC").build();
        em.persist(restaurant);
        Position position = Position.builder().restaurant(restaurant).name("Staff").build(); em.persist(position);
        User user = User.builder().phone("+70000000001").email("first@checklist.test").firstName("First").lastName("Worker").passwordHash("test").build(); em.persist(user);
        RestaurantMember member = RestaurantMember.builder().restaurant(restaurant).position(position).user(user).build(); em.persist(member);
        em.flush();
        return new Fixture(restaurant, position, user, member);
    }
    private ChecklistServiceImpl service(Instant now) {
        when(storage.toCompletionPhotoUrl(anyString())).thenAnswer(i -> i.getArgument(0));
        return new ChecklistServiceImpl(em, checklists, histories, restaurants, positions, members,
                new ChecklistMapper(storage), new ChecklistHistoryMapper(storage), new ChecklistHistoryService(histories),
                security, new RestaurantTimeService(restaurants, Clock.fixed(now, ZoneOffset.UTC)), storage, new RestaurantLifecycleMutex(restaurants));
    }
    private ChecklistRequest request(Fixture f, String periodicity, List<ChecklistItemRequest> items) {
        return new ChecklistRequest("Checklist", null, "TRACKABLE", periodicity, periodicity.equals("MANUAL") ? null : "08:00",
                null, null, null, items, List.of(f.position().getId()));
    }
    private ChecklistItemRequest item(Long id, String text, String mode) { return new ChecklistItemRequest(id, text, mode, mode.equals("REQUIRED")); }
    private ChecklistDto create(Fixture f, String periodicity) {
        return service(START).create(f.restaurant().getId(), f.user().getId(), request(f, periodicity,
                List.of(item(null, "First", "NONE"), item(null, "Old", "OPTIONAL"))));
    }

    @Test void replacementNeverInheritsDeletedItemsStateAndHistoryKeepsOriginalText() {
        var f = fixture(); var created = create(f, "MANUAL"); var svc = service(START);
        Long removedId = created.items().get(1).id();
        Checklist parent = em.find(Checklist.class, created.id());
        ChecklistItem old = parent.getItems().stream().filter(i -> i.getId().equals(removedId)).findFirst().orElseThrow();
        old.setDone(true); old.setDoneBy(f.member()); old.setDoneAt(START);
        old.setCompletionPhotoUrl("original-photo"); old.setExamplePhotoUrl("original-example"); em.flush();
        var updated = svc.update(f.restaurant().getId(), f.user().getId(), created.id(), request(f, "MANUAL",
                List.of(item(created.items().get(0).id(), "First", "NONE"), item(null, "New", "OPTIONAL"))), created.version());
        assertNotEquals(removedId, updated.items().get(1).id());
        assertFalse(updated.items().get(1).done()); assertNull(updated.items().get(1).doneBy());
        assertNull(updated.items().get(1).completionPhotoUrl()); assertNull(updated.items().get(1).examplePhotoUrl());
        em.clear();
        var history = svc.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50);
        var detail = svc.getHistory(f.restaurant().getId(), f.user().getId(), history.get(0).id());
        assertEquals("Old", detail.items().get(1).text()); assertTrue(detail.items().get(1).done());
        assertEquals("original-photo", detail.items().get(1).completionPhotoUrl());
    }

    @Test void reorderingAndAddingAnItemKeepsIdsAndUniqueOrder() {
        var f = fixture(); var created = create(f, "MANUAL");
        var updated = service(START).update(f.restaurant().getId(), f.user().getId(), created.id(), request(f, "MANUAL", List.of(
                item(null, "New first", "NONE"), item(created.items().get(1).id(), "Old", "OPTIONAL"), item(created.items().get(0).id(), "First", "NONE"))), created.version());
        em.clear();
        assertEquals(created.items().get(1).id(), updated.items().get(1).id());
        assertEquals(created.items().get(0).id(), updated.items().get(2).id());
        assertEquals(3, em.find(Checklist.class, created.id()).getItems().size());
    }

    @Test void eachMissedPeriodIsArchivedAtItsOwnBoundaryAndResetIsIdempotent() {
        var f = fixture(); var created = create(f, "DAILY");
        service(START).completeItem(f.restaurant().getId(), f.user().getId(), created.id(), created.items().get(0).id(), created.version());
        var later = service(START.plus(3, java.time.temporal.ChronoUnit.DAYS));
        later.processAutomaticResets(f.restaurant().getId()); em.flush(); em.clear();
        var list = later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50);
        assertEquals(3, list.size());
        assertEquals("2026-10-13T08:00:00Z", list.get(0).resetAt());
        assertEquals("2026-10-11T08:00:00Z", list.get(2).resetAt());
        assertEquals(1, list.get(2).completedItems()); assertEquals(0, list.get(0).completedItems());
        later.processAutomaticResets(f.restaurant().getId());
        assertEquals(3, later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50).size());
    }

    @Test void overdueEditArchivesTheOldTemplateBeforeChangingIt() {
        var f = fixture(); var created = create(f, "DAILY"); var later = service(START.plus(1, java.time.temporal.ChronoUnit.DAYS));
        later.update(f.restaurant().getId(), f.user().getId(), created.id(), request(f, "DAILY", List.of(
                item(created.items().get(0).id(), "Changed", "NONE"), item(created.items().get(1).id(), "Old", "OPTIONAL"))), created.version());
        var auto = later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50).stream()
                .filter(h -> "AUTO".equals(h.resetReason())).findFirst().orElseThrow();
        assertEquals("First", later.getHistory(f.restaurant().getId(), f.user().getId(), auto.id()).items().get(0).text());
    }

    @Test void staleVersionAndStalePeriodCannotCompleteAnItem() {
        var f = fixture(); var created = create(f, "DAILY"); var svc = service(START);
        var reserved = svc.reserveItem(f.restaurant().getId(), f.user().getId(), created.id(), created.items().get(0).id(), created.version());
        assertTrue(reserved.version() > created.version()); assertEquals(f.member().getId(), reserved.currentMemberId());
        assertThrows(ConflictException.class, () -> svc.completeItem(f.restaurant().getId(), f.user().getId(), created.id(), created.items().get(0).id(), created.version()));
        assertThrows(ConflictException.class, () -> service(START.plus(1, java.time.temporal.ChronoUnit.DAYS))
                .completeItem(f.restaurant().getId(), f.user().getId(), created.id(), created.items().get(0).id(), reserved.version()));
        assertFalse(em.find(ChecklistItem.class, created.items().get(0).id()).isDone());
    }

    @Test void deletingKeepsHistoryButExcludesTheChecklistFromWorkAndResetJobs() {
        var f = fixture(); var created = create(f, "MANUAL"); var svc = service(START);
        svc.delete(f.restaurant().getId(), f.user().getId(), created.id(), created.version()); em.clear();
        assertTrue(svc.list(f.restaurant().getId(), f.user().getId(), List.of(), null, null, null).isEmpty());
        assertEquals("DELETED", svc.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50).get(0).resetReason());
        assertEquals(1, svc.listRestaurantHistory(f.restaurant().getId(), f.user().getId(), 0, 50).size());
        assertThrows(NotFoundException.class, () -> svc.reset(f.restaurant().getId(), f.user().getId(), created.id(), 1L));
    }

    @Test void anotherStaffMemberCannotReplaceAnExistingPhoto() throws Exception {
        var f = fixture(); var created = create(f, "MANUAL");
        User otherUser = User.builder().phone("+70000000002").email("other@checklist.test").firstName("Other").lastName("Worker").passwordHash("test").build(); em.persist(otherUser);
        RestaurantMember other = RestaurantMember.builder().restaurant(f.restaurant()).position(f.position()).user(otherUser).build(); em.persist(other);
        var stored = em.find(ChecklistItem.class, created.items().get(1).id());
        stored.setCompletionPhotoUrl("original"); stored.setCompletionPhotoUploadedBy(f.member()); em.flush();
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream(); javax.imageio.ImageIO.write(image, "png", bytes);
        var file = new MockMultipartFile("file", "photo.png", "image/png", bytes.toByteArray());
        assertThrows(ConflictException.class, () -> service(START).uploadCompletionPhoto(f.restaurant().getId(), otherUser.getId(), created.id(), stored.getId(), file, created.version()));
        assertEquals("original", stored.getCompletionPhotoUrl()); verify(storage, never()).saveCompletionForItem(anyLong(), any());
    }

    @Test void creatorWithoutMembershipCanUndoButCannotActAsAnEmployee() {
        var f = fixture(); var created = create(f, "MANUAL"); var svc = service(START);
        when(security.hasAtLeastManager(999L, f.restaurant().getId())).thenReturn(true);
        var undone = svc.undoItem(f.restaurant().getId(), 999L, created.id(), created.items().get(0).id(), created.version());
        assertNull(undone.currentMemberId());
        assertThrows(BadRequestException.class, () -> svc.completeItem(f.restaurant().getId(), 999L, created.id(), created.items().get(0).id(), undone.version()));
    }

    @Test void changingFromManualToDailyStartsTheScheduleNowAndDoesNotInventPastPeriods() {
        var f = fixture(); var created = create(f, "MANUAL"); var later = service(START.plus(10, java.time.temporal.ChronoUnit.DAYS));
        var completed = service(START).completeItem(f.restaurant().getId(), f.user().getId(), created.id(), created.items().get(0).id(), created.version());
        later.update(f.restaurant().getId(), f.user().getId(), created.id(), request(f, "DAILY", List.of(
                item(created.items().get(0).id(), "First", "NONE"), item(created.items().get(1).id(), "Old", "OPTIONAL"))), completed.version());
        later.processAutomaticResets(f.restaurant().getId());
        assertEquals(1, later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50).size());
        assertTrue(em.find(Checklist.class, created.id()).getItems().stream().noneMatch(ChecklistItem::isDone));
    }

    @Test void requiredPhotoMustBeValidAndCannotBeChangedAfterCompletion() throws Exception {
        var f = fixture(); var svc = service(START);
        var created = svc.create(f.restaurant().getId(), f.user().getId(), request(f, "MANUAL", List.of(item(null, "Photo required", "REQUIRED"))));
        Long itemId = created.items().get(0).id();
        assertThrows(BadRequestException.class, () -> svc.completeItem(f.restaurant().getId(), f.user().getId(), created.id(), itemId, created.version()));
        java.awt.image.BufferedImage image = new java.awt.image.BufferedImage(2, 2, java.awt.image.BufferedImage.TYPE_INT_RGB);
        java.io.ByteArrayOutputStream bytes = new java.io.ByteArrayOutputStream(); javax.imageio.ImageIO.write(image, "png", bytes);
        var file = new MockMultipartFile("file", "photo.png", "image/png", bytes.toByteArray());
        when(storage.saveCompletionForItem(eq(itemId), any())).thenReturn("checklists/items/" + itemId + "/completion/photo.png");
        var uploaded = svc.uploadCompletionPhoto(f.restaurant().getId(), f.user().getId(), created.id(), itemId, file, created.version());
        assertEquals(f.member().getId(), uploaded.items().get(0).completionPhotoUploadedBy().id());
        var completed = svc.completeItem(f.restaurant().getId(), f.user().getId(), created.id(), itemId, uploaded.version());
        assertTrue(completed.completed());
        assertThrows(BadRequestException.class, () -> svc.deleteCompletionPhoto(f.restaurant().getId(), f.user().getId(), created.id(), itemId, completed.version()));
    }

    @Test void fakeImageSignatureIsNotEnoughToUploadAFile() throws Exception {
        var f = fixture(); var created = create(f, "MANUAL");
        var file = new MockMultipartFile("file", "fake.png", "image/png", new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0});
        assertThrows(BadRequestException.class, () -> service(START).uploadCompletionPhoto(f.restaurant().getId(), f.user().getId(), created.id(), created.items().get(1).id(), file, created.version()));
        verify(storage, never()).saveCompletionForItem(anyLong(), any());
    }

    @Test void historyPagesDoNotSilentlyStopAtFiftyRecords() {
        var f = fixture(); var created = create(f, "DAILY"); var later = service(START.plus(55, java.time.temporal.ChronoUnit.DAYS));
        later.processAutomaticResets(f.restaurant().getId());
        var first = later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 0, 50);
        var second = later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), 1, 50);
        assertEquals(50, first.size()); assertEquals(5, second.size());
        assertTrue(Collections.disjoint(first.stream().map(ChecklistHistorySummaryDto::id).toList(), second.stream().map(ChecklistHistorySummaryDto::id).toList()));
        assertThrows(BadRequestException.class, () -> later.listHistory(f.restaurant().getId(), f.user().getId(), created.id(), -1, 50));
    }

    @Test void emptyPositionsAndMidnight24AreRejectedAtTheServiceBoundary() {
        var f = fixture(); var svc = service(START);
        var empty = new ChecklistRequest("Invalid", null, "TRACKABLE", "MANUAL", null, null, null, List.of("Item"), null, List.of());
        assertThrows(BadRequestException.class, () -> svc.create(f.restaurant().getId(), f.user().getId(), empty));
        var midnight24 = new ChecklistRequest("Invalid", null, "TRACKABLE", "DAILY", "24:00", null, null, List.of("Item"), null, List.of(f.position().getId()));
        assertThrows(BadRequestException.class, () -> svc.create(f.restaurant().getId(), f.user().getId(), midnight24));
    }
}
