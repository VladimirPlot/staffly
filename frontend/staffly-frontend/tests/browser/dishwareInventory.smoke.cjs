// Run against a local Vite server; requires Playwright (or NODE_PATH pointing to its installation).
// STAFFLY_TEST_URL defaults to http://127.0.0.1:5178. All API responses are mocked.
// Start Vite with: npm run dev -- --host 127.0.0.1 --port 5178
const { chromium } = require("playwright");
const baseUrl = process.env.STAFFLY_TEST_URL || "http://127.0.0.1:5178";
const assert = require("node:assert/strict");
(async () => {
  const browser = await chromium.launch({
    channel: process.env.STAFFLY_TEST_BROWSER_CHANNEL || (process.platform === "win32" ? "msedge" : undefined),
    headless: true,
  });
  const context = await browser.newContext({ viewport: { width: 1440, height: 1000 } });
  const token =
    "test." + Buffer.from(JSON.stringify({ restaurantId: 2, exp: 9999999999 })).toString("base64url") + ".test";
  await context.addInitScript((t) => localStorage.setItem("accessToken", t), token);
  let inventory = {
    id: 3,
    restaurantId: 2,
    title: "Посуда",
    inventoryDate: "2026-10-18",
    status: "DRAFT",
    sortOrder: 0,
    itemsCount: 1,
    totalLossQty: 2,
    totalLossAmount: 100,
    createdAt: "2026-10-18",
    updatedAt: "2026-10-18",
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
  let writes = [];
  let fail = false;
  let delay = 0;
  await context.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (!path.startsWith("/api/")) {
      await route.continue();
      return;
    }
    let data = [];
    if (path === "/api/me") data = { userId: 1, firstName: "Тест", phone: "000", restaurantId: 2, roles: ["MANAGER"] };
    else if (path === "/api/me/memberships") data = [{ restaurantId: 2, role: "MANAGER" }];
    else if (path === "/api/restaurants/2") data = { id: 2, name: "Тест" };
    else if (path.endsWith("/dishware/3")) {
      if (req.method() === "PUT") {
        writes.push(req.postDataJSON());
        if (delay) await new Promise((r) => setTimeout(r, delay));
        if (fail) {
          await route.fulfill({ status: 503, json: { message: "Нет связи" } });
          return;
        }
        const body = req.postDataJSON();
        inventory = { ...inventory, ...body, items: body.items.map((i, index) => ({ ...i, id: i.id ?? 100 + index })) };
      }
      data = inventory;
    } else if (path.endsWith("/dishware")) data = [inventory];
    else if (path.includes("unread")) data = { count: 0 };
    await route.fulfill({ json: data });
  });
  const page = await context.newPage();
  const errors = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("dialog", (d) => d.accept());
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  await page.getByRole("button", { name: "Сохранить", exact: true }).waitFor();
  const qty = page.getByRole("textbox", { name: "Стало, позиция 1", exact: true });
  await qty.fill("12шт");
  await page.waitForTimeout(2100);
  assert.equal(writes.length, 0, "invalid input must not autosave");
  assert.equal(await qty.inputValue(), "12шт");
  assert.equal(await qty.getAttribute("aria-invalid"), "true");
  await page.reload();
  await qty.waitFor();
  assert.equal(await qty.inputValue(), "12шт", "raw input recovered");
  await qty.fill("8");
  await page.waitForTimeout(2300);
  assert.equal(writes.length, 1, "valid edits autosave once");
  assert.equal(inventory.items[0].currentQty, 8);
  assert.equal(await page.getByText("Все изменения сохранены", { exact: true }).count(), 1);
  assert.equal(await page.evaluate(() => localStorage.getItem("staffly:dishware-draft:v1:1:2:3")), null);
  await qty.fill("7");
  await page.getByRole("button", { name: "Назад к списку" }).click();
  await page.getByRole("button", { name: "Выйти без сохранения", exact: true }).click();
  await page.waitForURL("**/inventories/dishware");
  assert.equal(inventory.items[0].currentQty, 8, "discard must not send pending edits");
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  await qty.waitFor();
  assert.equal(await qty.inputValue(), "8");
  await qty.fill("6");
  await page.getByRole("button", { name: "Назад к списку" }).click();
  await page.getByRole("button", { name: "Выйти и сохранить данные", exact: true }).click();
  await page.waitForURL("**/inventories/dishware");
  assert.equal(inventory.items[0].currentQty, 6);
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  await qty.waitFor();
  await page.getByRole("button", { name: "Заметка", exact: true }).click();
  const note = page.getByRole("textbox", { name: "Заметка", exact: true });
  assert.equal(await note.getAttribute("maxlength"), "5000");
  await note.fill("я".repeat(5001));
  assert.equal((await note.inputValue()).length, 5000);
  await page.getByRole("button", { name: "Готово", exact: true }).click();
  await page.waitForTimeout(2300);
  assert.equal(inventory.items[0].note.length, 5000);
  // Slow saves must preserve edits made before the first response arrives.
  delay = 2500;
  await qty.fill("5");
  await page.waitForTimeout(2000);
  assert.equal(await qty.isEnabled(), true, "autosave must allow continued typing");
  await qty.fill("4");
  await page.waitForTimeout(6500);
  assert.equal(await qty.inputValue(), "4");
  assert.equal(inventory.items[0].currentQty, 4);
  delay = 0;
  fail = true;
  await qty.fill("3");
  await page.waitForTimeout(2300);
  assert.ok((await page.getByRole("alert").count()) > 0, "network failures must be visible");
  assert.ok(
    await page.evaluate(() => localStorage.getItem("staffly:dishware-draft:v1:1:2:3")),
    "failed saves keep local copy",
  );
  await page.getByRole("button", { name: "Назад к списку" }).click();
  await page.getByRole("button", { name: "Выйти и сохранить данные", exact: true }).click();
  await page.waitForTimeout(500);
  assert.ok(page.url().endsWith("/dishware/3"), "failed exit-save must stay in editor");
  assert.ok((await page.getByRole("dialog").count()) > 0);
  fail = false;
  await page.getByRole("button", { name: "Выйти и сохранить данные", exact: true }).click();
  await page.waitForURL("**/inventories/dishware");
  assert.equal(inventory.items[0].currentQty, 3);
  // Browser Back uses the same guard; cancelling preserves pending input.
  await page.getByRole("option").first().dblclick();
  await qty.waitFor();
  await qty.fill("2");
  await page.goBack();
  await page.getByRole("button", { name: "Остаться", exact: true }).click();
  assert.equal(await qty.inputValue(), "2");
  // Additions must keep their assigned IDs and their focus after autosave.
  await page.getByRole("button", { name: "Добавить позицию", exact: true }).first().click();
  const newName = page.getByPlaceholder("Название позиции").nth(1);
  await newName.fill("Бокал");
  await page.waitForTimeout(2300);
  assert.equal(inventory.items.length, 2);
  assert.ok(inventory.items[1].id);
  assert.equal(await newName.evaluate((el) => el === document.activeElement), true);
  await page.getByRole("textbox", { name: "Стало, позиция 2", exact: true }).fill("5");
  await page.waitForTimeout(2300);
  assert.equal(inventory.items.length, 2);
  assert.equal(inventory.items[1].currentQty, 5);
  // Recovering a copy based on an older server document requires an explicit choice.
  await qty.fill("bad");
  await page.waitForTimeout(100);
  inventory.title = "Изменено другим менеджером";
  await page.reload();
  await page.getByRole("button", { name: "Восстановить мои изменения", exact: true }).click();
  assert.equal(await qty.inputValue(), "bad");
  await page.reload();
  await qty.waitFor();
  assert.equal(await qty.inputValue(), "bad");
  await qty.fill("1");
  const beforeReview = writes.length;
  await page.waitForTimeout(2200);
  assert.equal(writes.length, beforeReview, "conflicting recovery must wait for manual review/save");
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  assert.equal(inventory.items[0].currentQty, 1);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: validation, reload recovery, autosave, both exit choices, failed exit-save, 5000-character note, slow-save typing, offline recovery, browser Back, new row IDs/focus, conflicting recovery.",
  );
  await browser.close();
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
