// Real UI with synthetic API data; exercises the failure paths found in the mobile audit.
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
  const context = await browser.newContext({ viewport: { width: 320, height: 700 }, isMobile: true, hasTouch: true });
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
    createdAt: "2026-10-19",
    updatedAt: "2026-10-19",
    items: Array.from({ length: 40 }, (_, i) => ({
      id: 10 + i,
      clientKey: `row-${i}`,
      name: `Тарелка ${i + 1}`,
      previousQty: 10,
      incomingQty: 0,
      currentQty: 8,
      unitPrice: null,
      sortOrder: i,
    })),
  };
  let fail = false,
    writes = 0;
  await context.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const respond = (json, status = 200) => route.fulfill({ json, status });
    if (path === "/api/me")
      return respond({ userId: 1, firstName: "Тест", phone: "000", restaurantId: 2, roles: ["MANAGER"] });
    if (path === "/api/me/memberships") return respond([{ restaurantId: 2, role: "MANAGER" }]);
    if (path === "/api/restaurants/2") return respond({ id: 2, name: "Тест" });
    if (path.endsWith("/dishware/3") && req.method() === "PUT") {
      writes++;
      if (fail) return respond({ message: "Тестовая ошибка сохранения" }, 503);
      const body = req.postDataJSON();
      if (body.expectedVersion !== inventory.version)
        return respond(
          { message: "Документ изменён", meta: { type: "DISHWARE_VERSION_CONFLICT", current: inventory } },
          409,
        );
      inventory = { ...inventory, ...body, version: inventory.version + 1 };
      return respond(inventory);
    }
    if (path.endsWith("/dishware/3")) return respond(inventory);
    if (path.includes("unread")) return respond({ count: 0 });
    return respond([]);
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  const list = page.getByRole("list", { name: "Мобильный подсчёт посуды", exact: true });
  await list.waitFor();
  const rows = list.getByRole("listitem");
  const add = () => page.getByRole("button", { name: "Добавить позицию", exact: true }).last();
  await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
  await page.getByRole("button", { name: "Вернуться наверх", exact: true }).waitFor();
  await add().waitFor();
  await rows.last().getByRole("button", { name: "Заметка позиции 40", exact: true }).click();
  assert.equal(
    await page.getByRole("button", { name: "Добавить позицию", exact: true }).count(),
    1,
    "floating plus is removed while a dialog is open",
  );
  assert.equal(await page.getByRole("button", { name: "Вернуться наверх", exact: true }).count(), 0);
  await page.getByRole("dialog").getByRole("button", { name: "Готово", exact: true }).click();
  await add().waitFor();
  await rows.last().getByRole("button", { name: "Удалить позицию 40", exact: true }).click();
  const confirmation = page.getByRole("dialog", { name: "Удалить позицию?", exact: true });
  await confirmation.getByText("Данная позиция навсегда будет удалена.", { exact: true }).waitFor();
  await confirmation.getByRole("button", { name: "Отмена", exact: true }).click();
  assert.equal(await rows.count(), 40);
  assert.equal(writes, 0, "cancel does not save a deletion");
  await rows.last().getByRole("button", { name: "Удалить позицию 40", exact: true }).click();
  await confirmation.getByRole("button", { name: "Удалить", exact: true }).click();
  await eventually(() => inventory.items.length === 39, "confirmed deletion autosaves");
  fail = true;
  const current = () => page.getByRole("textbox", { name: "Стало, позиция 39", exact: true });
  await current().fill("7");
  const alert = page.getByRole("alert").filter({ hasText: "Тестовая ошибка сохранения" });
  await alert.waitFor();
  assert.ok(
    await alert.evaluate((n) => {
      const b = n.getBoundingClientRect();
      return b.top >= 0 && b.bottom <= window.innerHeight;
    }),
    "save error stays in the viewport at the bottom of a long list",
  );
  if (process.env.STAFFLY_TEST_SCREENSHOT) await page.screenshot({ path: process.env.STAFFLY_TEST_SCREENSHOT });
  fail = false;
  await page.getByRole("button", { name: "Повторить сохранение", exact: true }).click();
  await eventually(() => inventory.items[38].currentQty === 7, "retry persists the count");
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  assert.equal(await alert.count(), 0);
  // Empty counts and free dishware remain valid without new warnings.
  await current().fill("");
  await current().blur();
  await eventually(() => inventory.items[38].currentQty === 0, "empty count still saves as zero");
  assert.equal(inventory.items[38].unitPrice, null);
  assert.equal(await page.getByRole("alert").count(), 0);
  await page.setViewportSize({ width: 320, height: 350 });
  await page.getByRole("textbox", { name: "Стало, позиция 20", exact: true }).press("Enter");
  await eventually(
    () =>
      page.getByRole("textbox", { name: "Стало, позиция 21", exact: true }).evaluate((n) => {
        const b = n.getBoundingClientRect();
        return document.activeElement === n && document.elementFromPoint(b.x + b.width / 2, b.y + b.height / 2) === n;
      }),
    "next field stays accessible on a short screen",
  );
  await page.setViewportSize({ width: 320, height: 700 });
  inventory = { ...inventory, status: "COMPLETED", version: inventory.version + 1 };
  await current().fill("3");
  const conflict = page.getByRole("dialog", { name: "Инвентаризация изменилась", exact: true });
  await conflict.waitFor();
  for (const width of [320, 390]) {
    await page.setViewportSize({ width, height: 700 });
    assert.ok(
      await conflict
        .getByRole("button", { name: "Использовать актуальный завершённый документ", exact: true })
        .evaluate((n) => {
          const b = n.getBoundingClientRect();
          return b.x >= 0 && b.right <= window.innerWidth && n.scrollWidth <= n.clientWidth;
        }),
      "completed conflict button fits the viewport",
    );
  }
  assert.equal(await page.getByRole("button", { name: "Вернуться наверх", exact: true }).count(), 0);
  await conflict.getByRole("button", { name: "Использовать актуальный завершённый документ", exact: true }).click();
  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).waitFor();
  assert.deepEqual(errors, []);
  console.log(
    "PASS: deletion cancel/confirm, modal floating controls, visible save failure/retry, zero/free items, short screen focus and mobile completed conflict.",
  );
  await browser.close();
})().catch(async (error) => {
  console.error(error);
  await browser?.close();
  process.exitCode = 1;
});
