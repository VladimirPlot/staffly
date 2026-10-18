package ru.staffly.inventory;

import jakarta.persistence.EntityManager;
import org.junit.jupiter.api.Test;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.jdbc.AutoConfigureTestDatabase;
import org.springframework.boot.test.autoconfigure.orm.jpa.DataJpaTest;
import org.springframework.boot.test.mock.mockito.MockBean;
import org.springframework.context.annotation.Import;
import org.springframework.transaction.PlatformTransactionManager;
import org.springframework.transaction.annotation.Propagation;
import org.springframework.transaction.annotation.Transactional;
import org.springframework.transaction.support.TransactionTemplate;
import ru.staffly.common.exception.*;
import ru.staffly.inventory.dto.*;
import ru.staffly.inventory.mapper.DishwareInventoryMapper;
import ru.staffly.inventory.model.*;
import ru.staffly.inventory.service.*;
import ru.staffly.media.DishwareInventoryImageStorage;
import ru.staffly.restaurant.model.Restaurant;
import ru.staffly.security.SecurityService;

import java.time.*;
import java.util.*;
import java.util.concurrent.*;
import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.when;

@DataJpaTest(properties = {
        "spring.flyway.enabled=false", "spring.jpa.hibernate.ddl-auto=create-drop",
        "spring.datasource.url=jdbc:h2:mem:dishware-concurrency;MODE=PostgreSQL;NON_KEYWORDS=VALUE,DAY;DB_CLOSE_DELAY=-1;LOCK_TIMEOUT=10000",
        "spring.datasource.driver-class-name=org.h2.Driver"
}, showSql = false)
@AutoConfigureTestDatabase(replace = AutoConfigureTestDatabase.Replace.NONE)
@Import({DishwareInventoryServiceImpl.class, DishwareInventoryMapper.class})
@Transactional(propagation = Propagation.NOT_SUPPORTED)
class DishwareInventoryConcurrencyTest {
    @Autowired DishwareInventoryService service;
    @Autowired EntityManager em;
    @Autowired PlatformTransactionManager transactions;
    @MockBean SecurityService security;
    @MockBean DishwareInventoryImageStorage storage;
    @MockBean DishwareInventoryPrintFormExporter exporter;

    private DishwareInventoryDto fixture() {
        return new TransactionTemplate(transactions).execute(tx -> {
            var restaurant = Restaurant.builder().name("Concurrency").code(UUID.randomUUID().toString()).timezone("UTC").build();
            em.persist(restaurant);
            var inventory = DishwareInventory.builder().restaurant(restaurant).title("Посуда").inventoryDate(LocalDate.of(2026, 10, 18))
                    .status(DishwareInventoryStatus.DRAFT).build();
            inventory.getItems().add(DishwareInventoryItem.builder().inventory(inventory).name("Тарелка")
                    .previousQty(100).currentQty(100).clientKey("plate").build());
            em.persist(inventory); em.flush();
            return new DishwareInventoryMapper().toDto(inventory);
        });
    }
    private UpdateDishwareInventoryRequest request(DishwareInventoryDto base, int count) {
        var row = base.items().get(0);
        return new UpdateDishwareInventoryRequest(base.title(), base.inventoryDate(), base.folderId(), base.comment(),
                List.of(new UpsertDishwareInventoryItemRequest(row.id(), row.name(), row.previousQty(), row.incomingQty(), count,
                        row.unitPrice(), 0, row.note(), row.clientKey())), base.version(), UUID.randomUUID());
    }
    private DishwareInventoryDto save(DishwareInventoryDto base, UpdateDishwareInventoryRequest request) {
        return service.update(base.restaurantId(), 1L, base.id(), request);
    }

    @Test void staleSaveCannotChangeRowsAndReportsCurrentSnapshot() {
        var initial = fixture();
        var first = save(initial, request(initial, 30));
        assertTrue(first.version() > initial.version());
        var conflict = assertThrows(ConflictException.class, () -> save(initial, request(initial, 40)));
        var current = (DishwareInventoryDto) conflict.getMeta().get("current");
        assertEquals(first.version(), current.version());
        assertEquals(30, current.items().get(0).currentQty());
        assertEquals(30, service.get(initial.restaurantId(), 1L, initial.id()).items().get(0).currentQty());
        assertThrows(ConflictException.class, () -> service.complete(initial.restaurantId(), 1L, initial.id(), initial.version()));
    }

    @Test void trulySimultaneousSavesAcceptExactlyOneWriter() throws Exception {
        var initial = fixture();
        var barrier = new CyclicBarrier(2);
        var pool = Executors.newFixedThreadPool(2);
        try {
            List<Future<Boolean>> results = new ArrayList<>();
            for (int count : new int[]{30, 40}) results.add(pool.submit(() -> {
                barrier.await(5, TimeUnit.SECONDS);
                try { save(initial, request(initial, count)); return true; }
                catch (ConflictException expected) { return false; }
            }));
            int accepted = 0;
            for (var result : results) if (result.get(15, TimeUnit.SECONDS)) accepted++;
            assertEquals(1, accepted);
        } finally { pool.shutdownNow(); }
    }

    @Test void retryOfAcknowledgedSaveNeverAddsTheSameCountsTwice() {
        var initial = fixture(); var operation = request(initial, 70);
        var first = save(initial, operation);
        var retry = save(initial, operation);
        assertEquals(first.version(), retry.version());
        assertEquals(70, retry.items().get(0).currentQty());
        var newer = save(first, request(first, 80));
        var conflict = assertThrows(ConflictException.class, () -> save(initial, operation));
        assertEquals(true, conflict.getMeta().get("alreadyApplied"));
        assertEquals(first.version(), conflict.getMeta().get("appliedVersion"));
        assertEquals(newer.version(), ((DishwareInventoryDto) conflict.getMeta().get("current")).version());
    }

    @Test void onlyItemEditsAdvanceVersionAndDuplicateRequestsCannotChangeTheirPayload() {
        var initial = fixture(); var operation = request(initial, 25);
        var saved = save(initial, operation);
        var tampered = new UpdateDishwareInventoryRequest(operation.title(), operation.inventoryDate(), null, "changed", operation.items(),
                operation.expectedVersion(), operation.requestId());
        assertThrows(BadRequestException.class, () -> save(initial, tampered));
        var completed = service.complete(initial.restaurantId(), 1L, initial.id(), saved.version());
        assertTrue(completed.version() > saved.version());
        assertThrows(ConflictException.class, () -> save(initial, request(saved, 50)));
    }

    @Test void restoredDocumentAndFolderLeaveHiddenAncestorsInTrash() {
        var initial = fixture();
        var ids = new TransactionTemplate(transactions).execute(tx -> {
            var restaurant = em.find(Restaurant.class, initial.restaurantId());
            var root = DishwareInventoryFolder.builder().restaurant(restaurant).name("Hidden").trashedAt(Instant.now()).build();
            em.persist(root);
            var child = DishwareInventoryFolder.builder().restaurant(restaurant).name("Nested").parent(root).trashedAt(Instant.now()).build();
            em.persist(child);
            var inventory = em.find(DishwareInventory.class, initial.id());
            inventory.setFolder(child); em.flush();
            return new Long[]{root.getId(), child.getId()};
        });
        var restored = service.restore(initial.restaurantId(), 1L, initial.id());
        assertNull(restored.folderId());
        assertTrue(restored.version() > initial.version());
        assertTrue(service.list(initial.restaurantId(), 1L).stream().anyMatch(item -> item.id().equals(initial.id())));
        var restoredFolder = service.restoreFolder(initial.restaurantId(), 1L, ids[1]);
        assertNull(restoredFolder.parentId()); assertNull(restoredFolder.trashedAt());
        new TransactionTemplate(transactions).execute(tx -> {
            assertNotNull(em.find(DishwareInventoryFolder.class, ids[0]).getTrashedAt()); return null;
        });
    }

    @Test void savedRowsHaveStableKeysAndReceiptsAreRemovedWithDocument() {
        var initial = fixture();
        var operation = new UpdateDishwareInventoryRequest(initial.title(), initial.inventoryDate(), null, null,
                List.of(new UpsertDishwareInventoryItemRequest(null, "Бокал", 0, 0, 2, null, 0, null, "new-glass")), initial.version(), UUID.randomUUID());
        var saved = save(initial, operation);
        assertEquals("new-glass", saved.items().get(0).clientKey());
        assertEquals(saved.items().get(0).id(), save(initial, operation).items().get(0).id());
        service.trash(initial.restaurantId(), 1L, initial.id());
        service.delete(initial.restaurantId(), 1L, initial.id());
        assertThrows(NotFoundException.class, () -> service.get(initial.restaurantId(), 1L, initial.id()));
    }

    @Test void photoChangesAdvanceTheSameRevisionAndRejectStaleEdits() throws Exception {
        var initial = fixture(); var itemId = initial.items().get(0).id();
        byte[] png = new byte[]{(byte) 0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0};
        var file = new org.springframework.mock.web.MockMultipartFile("file", "plate.png", "image/png", png);
        when(storage.saveForItem(itemId, file)).thenReturn("/plate.png");
        var uploaded = service.uploadItemImage(initial.restaurantId(), 1L, initial.id(), itemId, initial.version(), file);
        assertTrue(uploaded.version() > initial.version());
        assertEquals("/plate.png", uploaded.items().get(0).photoUrl());
        assertThrows(ConflictException.class, () -> save(initial, request(initial, 5)));
        assertThrows(ConflictException.class, () -> service.deleteItemImage(initial.restaurantId(), 1L, initial.id(), itemId, initial.version()));
        var removed = service.deleteItemImage(initial.restaurantId(), 1L, initial.id(), itemId, uploaded.version());
        assertNull(removed.items().get(0).photoUrl());
        assertTrue(removed.version() > uploaded.version());
    }
}
