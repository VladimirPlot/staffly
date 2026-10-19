import assert from "node:assert/strict";
import test from "node:test";
import "./registerTsx.ts";
import type { DishwareInventoryDto } from "../src/features/inventories/api.ts";
const { parseDishwareCountInput, parseDishwareMoneyInput, computeDishwareSummary } = await import(
  "../src/features/inventories/utils.ts"
);
const { buildDishwareInventoryItemsPayload } = await import("../src/features/inventories/dishwareInventoryItems.ts");
const {
  dishwareDraftFromServer,
  dishwareDraftError,
  dishwareDraftFingerprint,
  dishwareDraftKey,
  readDishwareDraft,
  mergeDishwareSavedRows,
} = await import("../src/features/inventories/dishwareDraft.ts");

function inventory(): DishwareInventoryDto {
  return {
    id: 3,
    version: 0,
    restaurantId: 2,
    title: "Посуда",
    inventoryDate: "2026-10-18",
    status: "DRAFT",
    sortOrder: 0,
    itemsCount: 1,
    totalLossQty: 2,
    totalLossAmount: 100,
    createdAt: "",
    updatedAt: "",
    items: [
      {
        id: 10,
        name: "Тарелка",
        previousQty: 10,
        incomingQty: 2,
        currentQty: 10,
        unitPrice: 50,
        sortOrder: 0,
        diffQty: -2,
        lossQty: 2,
        gainQty: 0,
        lossAmount: 100,
      },
    ],
  };
}

test("counts reject invalid, fractional and excessive input instead of changing it", () => {
  for (const value of ["12шт", "-5", "1,5", "1.5", "1e3", "Infinity", "NaN", "1000001", "0x10", "1\n2"]) {
    assert.throws(() => parseDishwareCountInput(value), Error, value);
  }
  assert.equal(parseDishwareCountInput("100000"), 100000);
  assert.equal(parseDishwareCountInput("1 000 000"), 1000000);
  assert.equal(parseDishwareCountInput("0"), 0);
  assert.equal(parseDishwareCountInput(""), 0);
});

test("money accepts Russian decimals and rejects silent truncation, rounding and clamping", () => {
  for (const value of ["250руб", "-1", "1,234", "1.234", "1e3", "1000000", "12,", "1.2.3"]) {
    assert.throws(() => parseDishwareMoneyInput(value), Error, value);
  }
  assert.equal(parseDishwareMoneyInput("999 999,99"), 999999.99);
  assert.equal(parseDishwareMoneyInput("12,50"), 12.5);
  assert.equal(parseDishwareMoneyInput("0"), 0);
  assert.equal(parseDishwareMoneyInput(""), null);
});

test("a document with invalid numbers cannot build a save request", () => {
  const draft = dishwareDraftFromServer(inventory());
  draft.items[0].currentQty = "12шт";
  assert.throws(() => buildDishwareInventoryItemsPayload(draft.items));
  assert.match(dishwareDraftError(draft)!, /Позиция 1/);
  draft.items[0].currentQty = "8";
  assert.equal(dishwareDraftError(draft), null);
  const summary = computeDishwareSummary(draft.items);
  assert.equal(summary.lossQty, 4);
  assert.equal(summary.totalLossAmount, 200);
});

test("notes allow exactly 5000 characters; invalid dates and oversized names are blocked", () => {
  const draft = dishwareDraftFromServer(inventory());
  draft.items[0].note = "я".repeat(5000);
  assert.equal(dishwareDraftError(draft), null);
  assert.equal(buildDishwareInventoryItemsPayload(draft.items)[0].note?.length, 5000);
  draft.items[0].note += "я";
  assert.match(dishwareDraftError(draft)!, /5000/);
  draft.items[0].note = "";
  draft.inventoryDate = "2026-02-30";
  assert.match(dishwareDraftError(draft)!, /дату/);
  draft.inventoryDate = "2026-10-18";
  draft.items[0].name = "я".repeat(201);
  assert.match(dishwareDraftError(draft)!, /200/);
});

test("recovery retains raw invalid input, separates accounts and ignores damaged storage", () => {
  const draft = dishwareDraftFromServer(inventory());
  const base = dishwareDraftFingerprint(draft);
  draft.items[0].currentQty = "1,5";
  draft.items[0].unitPrice = "12,";
  const key = dishwareDraftKey(1, 2, 3);
  assert.notEqual(key, dishwareDraftKey(2, 2, 3));
  assert.notEqual(key, dishwareDraftKey(1, 3, 3));
  assert.notEqual(key, dishwareDraftKey(1, 2, 4));
  const stored = readDishwareDraft({ getItem: () => JSON.stringify({ version: 1, base, draft }) }, key);
  assert.equal(stored?.draft.items[0].currentQty, "1,5");
  assert.equal(stored?.draft.items[0].unitPrice, "12,");
  assert.equal(stored?.base, base);
  for (const raw of ["{", "null", "{}", JSON.stringify({ version: 1, base, draft: { ...draft, items: [null] } })]) {
    assert.equal(readDishwareDraft({ getItem: () => raw }, key), null);
  }
});

test("slow saves attach new IDs without losing newer edits, additions or removals", () => {
  const sent = dishwareDraftFromServer(inventory());
  sent.items[0].id = undefined;
  const current = structuredClone(sent);
  current.title = "Новое название";
  current.items[0].currentQty = "7";
  current.items.push({ ...sent.items[0], clientId: "new-row", name: "Бокал", currentQty: "3" });
  const merged = mergeDishwareSavedRows(current, sent, inventory());
  assert.equal(merged.title, "Новое название");
  assert.equal(merged.items[0].currentQty, "7");
  assert.equal(merged.items[0].id, 10);
  assert.equal(merged.items[1].id, undefined);
  assert.equal(merged.items[1].currentQty, "3");
  current.items.shift();
  assert.equal(mergeDishwareSavedRows(current, sent, inventory()).items.length, 1);
});

test("canonical fingerprints do not treat formatting, row IDs or photo changes as unsaved edits", () => {
  const draft = dishwareDraftFromServer(inventory());
  const base = dishwareDraftFingerprint(draft);
  draft.items[0].currentQty = "010";
  draft.items[0].unitPrice = "50,00";
  draft.items[0].clientId = "different";
  draft.items[0].id = 999;
  draft.items[0].photoUrl = "/image.jpg";
  assert.equal(dishwareDraftFingerprint(draft), base);
  draft.items.reverse();
  draft.items[0].currentQty = "9";
  assert.notEqual(dishwareDraftFingerprint(draft), base);
});

test("surplus cannot offset shortages by default; explicit accounting permits a positive balance", async () => {
  const { formatInventoryLossAmount, formatCompactInventoryMoney } = await import(
    "../src/features/inventories/utils.ts"
  );
  const rows = [
    { previousQty: 10, currentQty: 8, unitPrice: 50 },
    { previousQty: 10, currentQty: 15, unitPrice: 30 },
  ];
  assert.equal(computeDishwareSummary(rows).totalLossAmount, 100);
  assert.equal(computeDishwareSummary(rows, true).totalLossAmount, -50);
  assert.match(formatInventoryLossAmount(-50), /50/);
  assert.ok(!formatInventoryLossAmount(-50).includes("-"));
  assert.ok(formatCompactInventoryMoney(100).includes("-"));
  assert.ok(!formatCompactInventoryMoney(-50).includes("-"));
});

test("surplus option is durable and invalid local values cannot silently enable it", () => {
  const base = dishwareDraftFromServer(inventory());
  const selected = { ...base, includeSurplus: true };
  assert.notEqual(dishwareDraftFingerprint(base), dishwareDraftFingerprint(selected));
  const stored = (draft: unknown) => ({ getItem: () => JSON.stringify({ version: 1, base: "base", draft }) });
  assert.equal(readDishwareDraft(stored(selected), "key")?.draft.includeSurplus, true);
  assert.equal(readDishwareDraft(stored({ ...base, includeSurplus: "false" }), "key"), null);
});

test("history describes metadata, counts and deleted rows with their original values", async () => {
  const { dishwareHistoryChanges } = await import("../src/features/inventories/dishwareHistory.ts");
  const before = inventory();
  const after = {
    ...before,
    status: "COMPLETED" as const,
    includeSurplus: true,
    items: before.items.map((row) => ({ ...row, currentQty: 7 })),
  };
  const changes = dishwareHistoryChanges(before, after);
  assert.ok(changes.some((text) => text.includes("Стало: 10 → 7")));
  assert.ok(changes.some((text) => text.includes("Черновик → Завершена")));
  assert.ok(changes.some((text) => text.includes("выключен → включён")));
  assert.ok(
    dishwareHistoryChanges(before, { ...before, items: [] }).some(
      (text) => text.includes("Удалена позиция:") && text.includes("Стало: 10"),
    ),
  );
});
