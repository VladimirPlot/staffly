import assert from "node:assert/strict";
import test from "node:test";
import "./registerTsx.ts";
import type { DishwareInventoryDto } from "../src/features/inventories/api.ts";
const { dishwareDraftFromServer, dishwareDraftError, readDishwareDraft } = await import(
  "../src/features/inventories/dishwareDraft.ts"
);
const { resolveDishwareConflict, summarizeDishwareConflict } = await import(
  "../src/features/inventories/dishwareConflict.ts"
);
const { isDishwareFolderHidden } = await import("../src/features/inventories/dishwareInventoryFolders.ts");

function inventory(): DishwareInventoryDto {
  return {
    id: 1,
    version: 2,
    restaurantId: 3,
    title: "Посуда",
    inventoryDate: "2026-10-18",
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
        previousQty: 100,
        incomingQty: 10,
        currentQty: 100,
        unitPrice: 50,
        sortOrder: 0,
        note: "",
        diffQty: -10,
        lossQty: 10,
        gainQty: 0,
        lossAmount: 500,
      },
    ],
  };
}
function conflict(localCount = 30, remoteCount = 40) {
  const original = inventory(),
    base = dishwareDraftFromServer(original),
    local = structuredClone(base),
    current = structuredClone(original);
  local.items[0].currentQty = String(localCount);
  current.items[0].currentQty = remoteCount;
  current.version++;
  return { base, local, current };
}

test("sum combines independently changed counts without doubling previous amounts, incoming or prices", () => {
  const c = conflict();
  const merged = resolveDishwareConflict(c, "sum");
  assert.equal(merged.items[0].currentQty, 70);
  assert.equal(merged.items[0].previousQty, 100);
  assert.equal(merged.items[0].incomingQty, 10);
  assert.equal(merged.items[0].unitPrice, 50);
  assert.equal(resolveDishwareConflict(c, "overwrite").items[0].currentQty, "30");
  assert.equal(resolveDishwareConflict(conflict(30, 30), "sum").items[0].currentQty, 60);
});

test("only locally or remotely changed counts are preserved as a single result", () => {
  assert.equal(resolveDishwareConflict(conflict(100, 40), "sum").items[0].currentQty, 40);
  assert.equal(resolveDishwareConflict(conflict(30, 100), "sum").items[0].currentQty, "30");
});

test("different fields in the same row merge; explicit conflicts prefer our metadata and combine notes", () => {
  const c = conflict();
  c.local.items[0].unitPrice = "60";
  c.current.items[0].name = "Тарелка большая";
  c.local.items[0].note = "Первый этаж";
  c.current.items[0].note = "Второй этаж";
  c.local.comment = "Первый менеджер";
  c.current.comment = "Второй менеджер";
  const result = resolveDishwareConflict(c, "sum");
  assert.equal(result.items[0].name, "Тарелка большая");
  assert.equal(result.items[0].unitPrice, "60");
  assert.equal(result.items[0].note, "Первый этаж\n\nВторой этаж");
  assert.equal(result.comment, "Первый менеджер\n\nВторой менеджер");
});

test("remote deletion plus our edit recreates the row without its deleted photo and retains both additions", () => {
  const c = conflict();
  c.local.items[0].photoUrl = "/deleted.jpg";
  c.current.items = [{ ...inventory().items[0], id: 20, clientKey: "remote-new", name: "Бокал", currentQty: 4 }];
  c.local.items.push({ ...c.local.items[0], id: undefined, clientId: "local-new", name: "Бокал", currentQty: 6 });
  for (const mode of ["overwrite", "sum"] as const) {
    const result = resolveDishwareConflict(c, mode);
    assert.equal(result.items.length, 3);
    const resurrected = result.items.find((row) => row.clientId === "plate")!;
    assert.equal(resurrected.id, undefined);
    assert.equal(resurrected.photoUrl, null);
    assert.equal(result.items.filter((row) => row.name === "Бокал").length, 2);
  }
  assert.match(
    summarizeDishwareConflict(c)
      .rows.find((row) => row.key === "plate")!
      .details.join(" "),
    /без удалённого фото/,
  );
});

test("our deletion versus a remote edit is explicit: overwrite deletes, sum preserves", () => {
  const c = conflict();
  c.local.items = [];
  assert.equal(resolveDishwareConflict(c, "overwrite").items.length, 0);
  assert.equal(resolveDishwareConflict(c, "sum").items[0].currentQty, 40);
  c.current.items[0].currentQty = 100;
  assert.equal(resolveDishwareConflict(c, "sum").items.length, 0);
});

test("remote deletions of unchanged rows and mutual deletions stay deleted", () => {
  const c = conflict(100);
  c.current.items = [];
  assert.equal(resolveDishwareConflict(c, "sum").items.length, 0);
  c.local.items = [];
  assert.equal(resolveDishwareConflict(c, "overwrite").items.length, 0);
});

test("a known new row with a stable key does not duplicate after a lost acknowledgement", () => {
  const c = conflict();
  c.base.items = [];
  c.local.items[0].id = undefined;
  c.local.items[0].currentQty = "40";
  const result = resolveDishwareConflict(c, "sum");
  assert.equal(result.items.length, 1);
  assert.equal(result.items[0].id, 10);
  assert.equal(result.items[0].currentQty, "40");
});

test("overflow and combined notes above the limit block resolution instead of clipping", () => {
  const c = conflict(600000, 600000);
  assert.match(dishwareDraftError(resolveDishwareConflict(c, "sum"))!, /количество/);
  c.local.items[0].currentQty = "30";
  c.current.items[0].currentQty = 40;
  c.local.items[0].note = "а".repeat(3000);
  c.current.items[0].note = "б".repeat(3000);
  assert.match(dishwareDraftError(resolveDishwareConflict(c, "sum"))!, /5000/);
  assert.equal(dishwareDraftError(resolveDishwareConflict(c, "overwrite")), null);
});

test("legacy drafts without an original snapshot cannot be summed blindly", () => {
  const c = { ...conflict(), base: null };
  assert.throws(() => resolveDishwareConflict(c, "sum"), /исходная версия/);
  assert.equal(resolveDishwareConflict(c, "overwrite").items[0].currentQty, "30");
});

test("pending operations survive reload with their original input and chosen merge result", () => {
  const c = conflict();
  const sent = resolveDishwareConflict(c, "sum");
  const stored = {
    version: 1,
    base: "base",
    draft: c.local,
    baseDraft: c.base,
    needsReview: true,
    pendingSave: {
      requestId: "operation",
      expectedVersion: c.current.version,
      folderId: null,
      snapshot: sent,
      input: c.local,
      base: c.base,
    },
  };
  const read = readDishwareDraft({ getItem: () => JSON.stringify(stored) }, "key")!;
  assert.equal(read.pendingSave?.snapshot.items[0].currentQty, 70);
  assert.equal(read.pendingSave?.input.items[0].currentQty, "30");
});

test("hidden folder detection walks ancestors and treats missing ancestors as unavailable", () => {
  const folder = (id: number, parentId: number | null, trashedAt: string | null = null) => ({
    id,
    parentId,
    trashedAt,
    name: "folder",
    restaurantId: 3,
    sortOrder: 0,
    createdAt: "",
    updatedAt: "",
  });
  const folders = [folder(1, null, "2026-10-18"), folder(2, 1), folder(3, null)];
  assert.equal(isDishwareFolderHidden(2, folders), true);
  assert.equal(isDishwareFolderHidden(3, folders), false);
  assert.equal(isDishwareFolderHidden(999, folders), true);
  assert.equal(isDishwareFolderHidden(null, folders), false);
});

test("surplus choice participates in three-way merging and conflict summaries", () => {
  const c = conflict();
  c.local.includeSurplus = true;
  assert.equal(resolveDishwareConflict(c, "sum").includeSurplus, true);
  assert.ok(
    summarizeDishwareConflict(c).metadata.some(
      (change) => change.field === "includeSurplus" && change.local === "Включён",
    ),
  );
  c.local.includeSurplus = false;
  c.current.includeSurplus = true;
  assert.equal(resolveDishwareConflict(c, "overwrite").includeSurplus, true);
});
