import assert from "node:assert/strict";
import test from "node:test";
import "./registerTsx.ts";
const { validateDishwarePhoto, DISHWARE_PHOTO_MAX_BYTES, isDishwarePendingPhoto } = await import(
  "../src/features/inventories/dishwarePhotoDraft.ts"
);
const { dishwareDraftFingerprint, readDishwareDraft, mergeDishwareSavedRows } = await import(
  "../src/features/inventories/dishwareDraft.ts"
);
const { resolveDishwareConflict } = await import("../src/features/inventories/dishwareConflict.ts");
import type { DishwareInventoryDto } from "../src/features/inventories/api.ts";

const photo = { token: "scope:photo", name: "plate.png", type: "image/png", size: 100 };
const pngHeader = new Uint8Array([0x89, 0x50, 0x4e, 0x47, 0, 0, 0, 0, 0, 0, 0, 0]);
function inventory(): DishwareInventoryDto {
  return {
    id: 1,
    restaurantId: 2,
    version: 0,
    title: "Посуда",
    inventoryDate: "2026-10-19",
    status: "DRAFT",
    sortOrder: 0,
    itemsCount: 1,
    totalLossQty: 0,
    totalLossAmount: 0,
    createdAt: "",
    updatedAt: "",
    items: [
      {
        id: 10,
        clientKey: "plate",
        name: "Тарелка",
        previousQty: 0,
        currentQty: 0,
        incomingQty: 0,
        sortOrder: 0,
        diffQty: 0,
        lossQty: 0,
        gainQty: 0,
        lossAmount: 0,
      },
    ],
  };
}
const draft = () => ({
  title: "Посуда",
  inventoryDate: "2026-10-19",
  comment: "",
  items: [
    { clientId: "plate", id: 10, name: "Тарелка", previousQty: 0, incomingQty: 0, currentQty: 0, pendingPhoto: photo },
  ],
});

test("photo validation matches backend format, signature and 2 MiB limit", async () => {
  await validateDishwarePhoto(new File([pngHeader], "plate.png", { type: "image/png" }));
  const large = new Uint8Array(DISHWARE_PHOTO_MAX_BYTES);
  large.set(pngHeader);
  await validateDishwarePhoto(new File([large], "limit.png", { type: "image/png" }));
  await assert.rejects(validateDishwarePhoto(new File([large, "x"], "over.png", { type: "image/png" })), /2 МБ/);
  await assert.rejects(validateDishwarePhoto(new File([pngHeader], "bad.gif", { type: "image/gif" })), /JPEG/);
  await assert.rejects(
    validateDishwarePhoto(new File(["not-an-image-file"], "fake.png", { type: "image/png" })),
    /корректным фото/,
  );
});

test("pending photo affects dirty state but not the text-only fingerprint", () => {
  const pending = draft(),
    clean = { ...pending, items: pending.items.map(({ pendingPhoto: _photo, ...item }) => item) };
  assert.notEqual(dishwareDraftFingerprint(pending), dishwareDraftFingerprint(clean));
  assert.equal(dishwareDraftFingerprint(pending, false), dishwareDraftFingerprint(clean, false));
  assert.notEqual(
    dishwareDraftFingerprint({ ...clean, items: clean.items.map((item) => ({ ...item, removePhoto: true })) }),
    dishwareDraftFingerprint(clean),
  );
});

test("draft metadata retains photo references and rejects broken descriptors without storing image bytes", () => {
  const raw = JSON.stringify({ version: 1, base: "base", draft: draft() });
  assert.deepEqual(readDishwareDraft({ getItem: () => raw }, "key")?.draft.items[0].pendingPhoto, photo);
  assert.equal(isDishwarePendingPhoto({ ...photo, size: DISHWARE_PHOTO_MAX_BYTES + 1 }), false);
  const bad = {
    ...draft(),
    items: draft().items.map((item) => ({ ...item, pendingPhoto: { ...photo, type: "text/html" } })),
  };
  assert.equal(
    readDishwareDraft({ getItem: () => JSON.stringify({ version: 1, base: "base", draft: bad }) }, "key"),
    null,
  );
});

test("assigning server IDs retains queued photos even when returned rows have a different order", () => {
  const local = draft(),
    server = inventory();
  server.items.unshift({ ...server.items[0], id: 20, clientKey: "other" });
  const merged = mergeDishwareSavedRows(local, local, server);
  assert.equal(merged.items[0].id, 10);
  assert.deepEqual(merged.items[0].pendingPhoto, photo);
});

test("conflict resolution keeps selected photos, including when another manager deleted the row", () => {
  const current = inventory(),
    base = { ...draft(), items: draft().items.map(({ pendingPhoto: _photo, ...item }) => item) };
  for (const mode of ["sum", "overwrite"] as const) {
    assert.deepEqual(resolveDishwareConflict({ base, local: draft(), current }, mode).items[0].pendingPhoto, photo);
    current.items = [];
    const result = resolveDishwareConflict({ base, local: draft(), current }, mode);
    assert.equal(result.items[0].id, undefined);
    assert.deepEqual(result.items[0].pendingPhoto, photo);
  }
});
