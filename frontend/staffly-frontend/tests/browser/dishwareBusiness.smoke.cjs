// Requires Playwright and local Vite; API uses synthetic data.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = process.env.STAFFLY_TEST_URL || "http://127.0.0.1:5178";
let browser;
async function eventually(check, message) {
  for (let i = 0; i < 180; i++) {
    if (await check()) return;
    await new Promise((resolve) => setTimeout(resolve, 50));
  }
  assert.fail(message);
}
(async () => {
  browser = await chromium.launch({
    channel: process.env.STAFFLY_TEST_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const token =
    "test." + Buffer.from(JSON.stringify({ restaurantId: 2, exp: 9999999999 })).toString("base64url") + ".test";
  await context.addInitScript((t) => localStorage.setItem("accessToken", t), token);
  let inventory = {
    id: 3,
    version: 0,
    restaurantId: 2,
    title: "Посуда",
    inventoryDate: "2026-10-19",
    status: "DRAFT",
    sortOrder: 0,
    itemsCount: 2,
    totalLossQty: 2,
    totalLossAmount: 100,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    includeSurplus: false,
    items: [
      {
        id: 10,
        clientKey: "plate",
        name: "Тарелка",
        previousQty: 10,
        incomingQty: 0,
        currentQty: 8,
        unitPrice: 50,
        sortOrder: 0,
      },
      {
        id: 11,
        clientKey: "glass",
        name: "Бокал",
        previousQty: 10,
        incomingQty: 0,
        currentQty: 15,
        unitPrice: 30,
        sortOrder: 1,
      },
    ],
  };
  let historyError = true,
    reopenError = true;
  const entries = [],
    requests = [];
  function record(action, before, reason) {
    entries.unshift({
      id: entries.length + 1,
      actorId: 1,
      actorName: "Тест Менеджер",
      action,
      reason,
      occurredAt: new Date().toISOString(),
      before,
      after: structuredClone(inventory),
    });
  }
  await context.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const respond = (json, status = 200) => route.fulfill({ json, status });
    if (path === "/api/me")
      return respond({ userId: 1, firstName: "Тест", phone: "000", restaurantId: 2, roles: ["MANAGER"] });
    if (path === "/api/me/memberships") return respond([{ restaurantId: 2, role: "MANAGER" }]);
    if (path === "/api/restaurants/2") return respond({ id: 2, name: "Тест" });
    if (path.endsWith("/history")) {
      if (historyError) return respond({ message: "История временно недоступна" }, 503);
      const beforeId = Number(new URL(req.url()).searchParams.get("beforeId")) || Infinity;
      return respond(entries.filter((entry) => entry.id < beforeId).slice(0, 30));
    }
    if (path.endsWith("/dishware/3") && req.method() === "PUT") {
      const body = req.postDataJSON(),
        before = structuredClone(inventory);
      requests.push(body);
      assert.equal(body.expectedVersion, inventory.version);
      assert.equal(inventory.status, "DRAFT");
      inventory = { ...inventory, ...body, version: inventory.version + 1, updatedAt: new Date().toISOString() };
      record("UPDATED", before);
      return respond(inventory);
    }
    if (path.endsWith("/complete") || path.endsWith("/reopen")) {
      const body = req.postDataJSON(),
        before = structuredClone(inventory);
      assert.equal(body.expectedVersion, inventory.version);
      if (path.endsWith("/reopen")) {
        assert.ok(body.reason.trim());
        if (reopenError) return respond({ message: "Не удалось открыть документ" }, 503);
      }
      inventory = {
        ...inventory,
        hasCorrections: inventory.hasCorrections || path.endsWith("/reopen"),
        version: inventory.version + 1,
        status: path.endsWith("/complete") ? "COMPLETED" : "DRAFT",
        updatedAt: new Date().toISOString(),
      };
      record(inventory.status === "COMPLETED" ? "COMPLETED" : "REOPENED", before, body.reason);
      return respond(inventory);
    }
    if (path.endsWith("/dishware/3")) return respond(inventory);
    if (path.includes("unread")) return respond({ count: 0 });
    return respond([]);
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  const flag = page.getByRole("checkbox", { name: "Учёт излишков", exact: true });
  await flag.waitFor();
  assert.equal(await flag.isChecked(), false);
  assert.match(await page.locator("dl").innerText(), /-100/);
  await flag.check();
  await eventually(() => inventory.includeSurplus, "surplus setting autosaves");
  assert.match(await page.locator("dl").innerText(), /Итоговый баланс/);
  assert.match(await page.locator("dl").innerText(), /50/);
  assert.ok(!(await page.locator("dl").innerText()).includes("-50"));
  await page.reload();
  await flag.waitFor();
  assert.equal(await flag.isChecked(), true);
  await flag.uncheck();
  await eventually(() => !inventory.includeSurplus, "surplus disabled again");
  assert.match(await page.locator("dl").innerText(), /-100/);
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).waitFor();
  assert.equal(await flag.isDisabled(), true);
  assert.equal(await page.getByRole("textbox", { name: "Стало, позиция 1", exact: true }).isDisabled(), true);
  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).click();
  const confirm = page.getByRole("button", { name: "Открыть для исправления", exact: true });
  assert.equal(await confirm.isDisabled(), true);
  await page.getByLabel("Причина исправления").fill("Уточнение подсчёта тарелок");
  await confirm.click();
  await page.getByRole("alert").filter({ hasText: "Не удалось открыть документ" }).last().waitFor();
  assert.equal(inventory.status, "COMPLETED");
  assert.equal(await page.getByLabel("Причина исправления").inputValue(), "Уточнение подсчёта тарелок");
  reopenError = false;
  await confirm.click();
  await page.getByRole("button", { name: "Завершить", exact: true }).waitFor();
  await page.getByRole("textbox", { name: "Стало, позиция 1", exact: true }).fill("7");
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).waitFor();
  assert.equal(inventory.items[0].currentQty, 7);
  await page.getByText("Документ открывали для исправления после завершения.", { exact: false }).waitFor();
  await page.getByRole("button", { name: "История изменений", exact: true }).click();
  const dialog = page.getByRole("dialog");
  await dialog.getByRole("alert").waitFor();
  historyError = false;
  await dialog.getByRole("button", { name: "Повторить загрузку", exact: true }).click();
  await dialog.getByText("Открыта для исправления", { exact: true }).waitFor();
  for (const detail of await dialog.locator("details").all()) await detail.locator("summary").click();
  await dialog.getByText("Причина: Уточнение подсчёта тарелок", { exact: true }).waitFor();
  await dialog.getByText("Тарелка · Стало: 8 → 7", { exact: true }).waitFor();
  assert.ok((await dialog.innerText()).includes("Учёт излишков: выключен → включён"));
  await dialog.getByRole("button", { name: "Закрыть", exact: true }).click();
  await page.setViewportSize({ width: 390, height: 844 });
  await page.getByRole("button", { name: "История изменений", exact: true }).click();
  await dialog.getByText("Открыта для исправления", { exact: true }).waitFor();
  assert.equal(await dialog.evaluate((node) => node.scrollWidth <= node.clientWidth + 1), true);
  assert.deepEqual(errors, []);
  if (process.env.STAFFLY_TEST_SCREENSHOT) await page.screenshot({ path: process.env.STAFFLY_TEST_SCREENSHOT });
  assert.equal(requests.length, 3);
  console.log(
    "PASS: surplus default, autosave/reload, signed balance, completion lock, reason validation, reopen failure/retry, audit differences and mobile history.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
