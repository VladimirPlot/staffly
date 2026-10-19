// Requires Playwright and a local Vite server. Every API request uses synthetic data.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = process.env.STAFFLY_TEST_URL || "http://127.0.0.1:5178";
let browser;
async function eventually(check, message) {
  for (let i = 0; i < 160; i++) {
    if (await check()) return;
    await new Promise((r) => setTimeout(r, 50));
  }
  assert.fail(message);
}
(async () => {
  browser = await chromium.launch({
    channel: process.env.STAFFLY_TEST_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
  });
  let inventory = {
    id: 3,
    version: 0,
    restaurantId: 2,
    title: "Посуда",
    inventoryDate: "2026-10-18",
    status: "DRAFT",
    sortOrder: 0,
    folderId: null,
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
        diffQty: 0,
        lossQty: 0,
        gainQty: 0,
        lossAmount: 0,
      },
    ],
  };
  let nextId = 100,
    writes = 0,
    loseAcknowledgement = false,
    failTrashRead = false,
    failRestore = false,
    failTrashWrite = false,
    rejectNextSave = false;
  const requestIds = [];
  const receipts = new Map(),
    folders = [];
  const errors = [];
  const qty = (page) =>
    page.getByRole("textbox", {
      name: `Стало, позиция ${inventory.items.findIndex((row) => row.clientKey === "plate") + 1}`,
      exact: true,
    });
  const count = () => inventory.items.find((row) => row.clientKey === "plate")?.currentQty;
  const hidden = (id) => {
    const f = folders.find((row) => row.id === id);
    return id != null && (!f || f.trashedAt || hidden(f.parentId));
  };
  async function session(userId) {
    const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
    const token =
      "test." + Buffer.from(JSON.stringify({ restaurantId: 2, exp: 9999999999 })).toString("base64url") + ".test";
    await context.addInitScript((t) => localStorage.setItem("accessToken", t), token);
    await context.route("**/api/**", async (route) => {
      const req = route.request(),
        path = new URL(req.url()).pathname;
      if (!path.startsWith("/api/")) return route.continue();
      const respond = (data, status = 200) => route.fulfill({ status, json: data });
      const conflict = (extra = {}) =>
        respond(
          {
            error: "CONFLICT",
            message: "Инвентаризацию изменил другой менеджер",
            meta: { type: "DISHWARE_VERSION_CONFLICT", current: inventory, ...extra },
          },
          409,
        );
      if (path === "/api/me")
        return respond({ userId, firstName: "Менеджер " + userId, phone: "000", restaurantId: 2, roles: ["MANAGER"] });
      if (path === "/api/me/memberships") return respond([{ restaurantId: 2, role: "MANAGER" }]);
      if (path === "/api/restaurants/2") return respond({ id: 2, name: "Тест" });
      if (path.endsWith("/dishware/3") && req.method() === "PUT") {
        writes++;
        const body = req.postDataJSON(),
          receipt = receipts.get(body.requestId);
        requestIds.push(body.requestId);
        if (rejectNextSave) {
          rejectNextSave = false;
          return respond({ message: "Тестовый отказ сохранения" }, 400);
        }
        assert.ok(Number.isSafeInteger(body.expectedVersion));
        assert.ok(body.requestId);
        if (receipt) {
          assert.equal(receipt.payload, JSON.stringify(body), "retry must repeat the identical operation");
          return receipt.version === inventory.version
            ? respond(inventory)
            : conflict({ alreadyApplied: true, appliedVersion: receipt.version });
        }
        if (body.expectedVersion !== inventory.version) return conflict();
        inventory = {
          ...inventory,
          ...body,
          version: inventory.version + 1,
          items: body.items.map((row) => ({
            ...row,
            id: row.id ?? inventory.items.find((old) => old.clientKey === row.clientKey)?.id ?? nextId++,
          })),
        };
        receipts.set(body.requestId, { payload: JSON.stringify(body), version: inventory.version });
        if (loseAcknowledgement) {
          loseAcknowledgement = false;
          return route.abort("failed");
        }
        return respond(inventory);
      }
      if (path.endsWith("/dishware/3/restore")) {
        if (failRestore) return respond({ message: "Тестовая ошибка восстановления" }, 503);
        inventory = {
          ...inventory,
          folderId: hidden(inventory.folderId) ? null : inventory.folderId,
          trashedAt: null,
          version: inventory.version + 1,
        };
        return respond(inventory);
      }
      if (path.endsWith("/dishware/3/trash")) {
        if (failTrashWrite) return respond({ message: "Тестовая ошибка удаления" }, 503);
        inventory = { ...inventory, trashedAt: "2026-10-18", version: inventory.version + 1 };
        return respond(inventory);
      }
      if (path.endsWith("/dishware/3")) return respond(inventory);
      if (path.endsWith("/dishware/trash"))
        return failTrashRead
          ? respond({ message: "Тестовая ошибка корзины" }, 503)
          : respond(inventory.trashedAt || hidden(inventory.folderId) ? [inventory] : []);
      if (path.endsWith("/dishware/folders"))
        return respond(
          new URL(req.url()).searchParams.get("includeTrashed") === "true"
            ? folders
            : folders.filter((f) => !hidden(f.id)),
        );
      if (path.endsWith("/dishware"))
        return respond(inventory.trashedAt || hidden(inventory.folderId) ? [] : [inventory]);
      if (path.includes("unread")) return respond({ count: 0 });
      return respond([]);
    });
    const page = await context.newPage();
    page.on("pageerror", (e) => errors.push(e.message));
    page.on("dialog", (d) => d.accept());
    await page.goto(`${baseUrl}/inventories/dishware/3`);
    await page.getByRole("button", { name: "Сохранить", exact: true }).waitFor();
    return page;
  }
  const a = await session(1),
    b = await session(2);
  await qty(a).fill("30");
  await eventually(() => count() === 30, "first manager autosaves");
  await qty(b).fill("40");
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).waitFor();
  await b.getByRole("button", { name: "Отмена", exact: true }).click();
  const beforeCancel = writes;
  await b.waitForTimeout(2200);
  assert.equal(writes, beforeCancel, "cancel pauses autosave");
  await b.getByRole("button", { name: "Сохранить", exact: true }).click();
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).waitFor();
  await qty(a).fill("35");
  await eventually(() => count() === 35, "third revision while conflict is open");
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).click();
  await b.getByText("Стало: на сервере «35», у вас «40»", { exact: true }).waitFor();
  assert.equal(count(), 35, "stale conflict confirmation must not overwrite another revision");
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).click();
  await eventually(() => count() === 75, "sum latest counts");
  await b.getByText("Все изменения сохранены", { exact: true }).waitFor();
  console.log("PASS: two sessions, cancel, repeated conflict, latest sum.");

  await Promise.all([a.reload(), b.reload()]);
  await qty(b).waitFor();
  await qty(b).fill("20");
  await b.getByRole("button", { name: "Добавить позицию", exact: true }).first().click();
  await a.getByRole("button", { name: "Удалить позицию 1", exact: true }).click();
  await a
    .getByRole("dialog", { name: "Удалить позицию?", exact: true })
    .getByRole("button", { name: "Удалить", exact: true })
    .click();
  await a.getByRole("button", { name: "Сохранить", exact: true }).click();
  await eventually(() => inventory.items.length === 0, "remote deletion");
  await a.getByRole("button", { name: "Добавить позицию", exact: true }).first().click();
  await a.getByPlaceholder("Название позиции").fill("Вилка");
  await a.getByRole("button", { name: "Сохранить", exact: true }).click();
  await eventually(() => inventory.items.some((row) => row.name === "Вилка"), "remote addition");
  await b.getByPlaceholder("Название позиции").nth(1).fill("Бокал");
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).click();
  await eventually(() => inventory.items.length === 3, "deleted edited row and both additions survive");
  assert.equal(count(), 20);
  assert.ok(inventory.items.some((row) => row.name === "Бокал"));
  assert.ok(inventory.items.some((row) => row.name === "Вилка"));
  await b.getByText("Все изменения сохранены", { exact: true }).waitFor();
  console.log("PASS: deleted edited row is recreated and both managers additions survive.");

  await Promise.all([a.reload(), b.reload()]);
  await qty(a).waitFor();
  await qty(a).fill("12");
  await eventually(() => count() === 12, "manager A new count");
  await qty(b).fill("8");
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).waitFor();
  loseAcknowledgement = true;
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).click();
  await b.getByRole("button", { name: "Повторить сохранение", exact: true }).waitFor();
  assert.equal(count(), 20);
  await b.reload();
  await b.getByRole("button", { name: "Повторить сохранение", exact: true }).waitFor();
  await a.reload();
  await qty(a).waitFor();
  await qty(a).fill("25");
  await eventually(() => count() === 25, "third edit after lost acknowledgement");
  await b.getByRole("button", { name: "Повторить сохранение", exact: true }).click();
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).waitFor();
  await b.getByRole("button", { name: "Сложить результаты", exact: true }).click();
  await b.getByText("Все изменения сохранены", { exact: true }).waitFor();
  assert.equal(count(), 25, "own already-applied sum must never be added twice");
  console.log("PASS: lost merge acknowledgement, reload, later remote edit and idempotent retry.");

  await a.reload();
  await qty(a).waitFor();
  rejectNextSave = true;
  await qty(a).fill("26");
  await a.getByRole("alert").filter({ hasText: "Тестовый отказ сохранения" }).waitFor();
  const rejectedRequest = requestIds.at(-1);
  await qty(a).fill("27");
  await eventually(() => count() === 27, "corrected input after definitive rejection");
  assert.notEqual(requestIds.at(-1), rejectedRequest);
  console.log("PASS: definitive rejection is visible and corrected input uses a new request ID.");

  folders.push(
    {
      id: 10,
      parentId: null,
      restaurantId: 2,
      name: "Скрытая",
      sortOrder: 0,
      trashedAt: "2026-10-18",
      createdAt: "",
      updatedAt: "",
    },
    {
      id: 11,
      parentId: 10,
      restaurantId: 2,
      name: "Вложенная",
      sortOrder: 0,
      trashedAt: null,
      createdAt: "",
      updatedAt: "",
    },
  );
  inventory = { ...inventory, folderId: 11, version: inventory.version + 1 };
  await a.goto(`${baseUrl}/inventories/dishware`);
  failTrashRead = true;
  await a.getByRole("button", { name: "Корзина", exact: true }).click();
  const trash = a.getByRole("dialog", { name: "Корзина", exact: true });
  await trash.getByRole("alert").waitFor();
  assert.equal(await trash.getByText("Корзина пуста.", { exact: true }).count(), 0);
  failTrashRead = false;
  await trash.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await trash.getByRole("button", { name: "Восстановить Посуда", exact: true }).click();
  const restore = a.getByRole("dialog", { name: "Восстановить в корень?", exact: true });
  await restore
    .getByText("Данный файл будет перемещен в корень, после вы можете переместить его куда удобно", { exact: true })
    .waitFor();
  failRestore = true;
  await restore.getByRole("button", { name: "Восстановить в корень", exact: true }).click();
  await restore.getByRole("alert").waitFor();
  assert.equal(inventory.folderId, 11);
  failRestore = false;
  await restore.getByRole("button", { name: "Восстановить в корень", exact: true }).click();
  await eventually(() => inventory.folderId === null, "restore to root");
  await trash
    .getByText("Инвентаризация восстановлена в корень. Теперь её можно переместить в удобное место.", { exact: true })
    .waitFor();
  assert.ok(folders[0].trashedAt, "ancestor must remain in trash");
  await a.getByRole("button", { name: "Закрыть корзину", exact: true }).click();
  await a.getByRole("option").first().dblclick();
  await a.getByRole("button", { name: "В корзину", exact: true }).click();
  const deletion = a.getByRole("dialog", { name: "Переместить в корзину", exact: true });
  failTrashWrite = true;
  await deletion.getByRole("button", { name: "В корзину", exact: true }).click();
  await deletion.getByRole("alert").waitFor();
  assert.equal(await deletion.isVisible(), true);
  await deletion.getByRole("button", { name: "Отмена", exact: true }).click();
  assert.deepEqual(errors, []);
  console.log("PASS: trash load errors/retry, root restore confirmation, failed restore, failed editor trash action.");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
