// Requires Playwright and local Vite; all API responses use synthetic data.
const { chromium } = require("playwright");
const assert = require("node:assert/strict");
const baseUrl = process.env.STAFFLY_TEST_URL || "http://127.0.0.1:5178";
const png = Buffer.from(
  "iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jRZkAAAAASUVORK5CYII=",
  "base64",
);
let browser;
async function eventually(check, message) {
  for (let i = 0; i < 180; i++) {
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
    itemsCount: 0,
    totalLossQty: 0,
    totalLossAmount: 0,
    createdAt: "",
    updatedAt: "",
    items: [],
  };
  let nextId = 100,
    failPhoto = true,
    photoCount = 0;
  const events = [],
    receipts = new Map();
  await context.route("**/photo/**", (route) => route.fulfill({ body: png, contentType: "image/png" }));
  await context.route("**/api/**", async (route) => {
    const req = route.request(),
      path = new URL(req.url()).pathname;
    if (!path.startsWith("/api/")) return route.continue();
    const respond = (json, status = 200) => route.fulfill({ status, json });
    const conflict = () =>
      respond(
        {
          message: "Документ изменён другим менеджером",
          meta: { type: "DISHWARE_VERSION_CONFLICT", current: inventory },
        },
        409,
      );
    if (path === "/api/me")
      return respond({ userId: 1, firstName: "Тест", phone: "000", restaurantId: 2, roles: ["MANAGER"] });
    if (path === "/api/me/memberships") return respond([{ restaurantId: 2, role: "MANAGER" }]);
    if (path === "/api/restaurants/2") return respond({ id: 2, name: "Тест" });
    if (path.endsWith("/dishware/3") && req.method() === "PUT") {
      const body = req.postDataJSON();
      events.push("PUT");
      if (receipts.has(body.requestId)) return respond(receipts.get(body.requestId));
      if (body.expectedVersion !== inventory.version) return conflict();
      inventory = {
        ...inventory,
        ...body,
        version: inventory.version + 1,
        items: body.items.map((row) => ({
          ...inventory.items.find((old) => old.id === row.id || old.clientKey === row.clientKey),
          ...row,
          id: row.id ?? nextId++,
        })),
      };
      receipts.set(body.requestId, structuredClone(inventory));
      return respond(inventory);
    }
    const image = path.match(/\/items\/(\d+)\/image$/);
    if (image) {
      const row = inventory.items.find((item) => item.id === Number(image[1]));
      assert.ok(row, "row must be saved before image upload");
      if (req.method() === "DELETE") {
        const version = Number(new URL(req.url()).searchParams.get("expectedVersion"));
        if (version !== inventory.version) return conflict();
        events.push("DELETE_IMAGE");
        row.photoUrl = null;
        inventory = { ...inventory, version: inventory.version + 1 };
        return respond(inventory);
      }
      const raw = req.postDataBuffer();
      const version = Number(raw.toString("utf8").match(/name="expectedVersion"\r\n\r\n(\d+)/)?.[1]);
      assert.ok(Number.isSafeInteger(version));
      events.push("PHOTO");
      if (version !== inventory.version) return conflict();
      if (failPhoto) return respond({ message: "Тестовая ошибка загрузки фото" }, 503);
      row.photoUrl = `${baseUrl}/photo/${row.id}/${++photoCount}.png`;
      inventory = { ...inventory, version: inventory.version + 1 };
      return respond(inventory);
    }
    if (path.endsWith("/complete") || path.endsWith("/reopen")) {
      const body = req.postDataJSON();
      if (body.expectedVersion !== inventory.version) return conflict();
      const complete = path.endsWith("/complete");
      events.push(complete ? "COMPLETE" : "REOPEN");
      inventory = { ...inventory, status: complete ? "COMPLETED" : "DRAFT", version: inventory.version + 1 };
      return respond(inventory);
    }
    if (path.endsWith("/dishware/3")) return respond(inventory);
    if (path.endsWith("/dishware")) return respond([inventory]);
    if (path.includes("unread")) return respond({ count: 0 });
    return respond([]);
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  page.on("dialog", (dialog) => dialog.accept());
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  const add = () => page.getByRole("button", { name: "Добавить позицию", exact: true }).first().click();
  const row = (index) => page.locator("tbody tr").nth(index);
  const pick = (index, buffer = png, name = "plate.png", mimeType = "image/png") =>
    row(index).locator("input[type=file]").setInputFiles({ name, mimeType, buffer });
  const preview = (index) => row(index).locator('img[src^="blob:"]');
  const pending = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("staffly:dishware-draft:v1:1:2:3") || "null"));
  const blobCount = () =>
    page.evaluate(
      () =>
        new Promise((resolve, reject) => {
          const request = indexedDB.open("staffly-dishware-photos", 1);
          request.onsuccess = () => {
            const db = request.result;
            const read = db.transaction("photos").objectStore("photos").count();
            read.onsuccess = () => {
              db.close();
              resolve(read.result);
            };
            read.onerror = reject;
          };
          request.onerror = reject;
        }),
    );
  await add();
  assert.equal(await page.getByRole("button", { name: "Добавить фото позиции 1", exact: true }).isEnabled(), true);
  const large = Buffer.alloc(2 * 1024 * 1024);
  png.copy(large);
  await pick(0, large);
  await preview(0).waitFor();
  await eventually(
    async () => await preview(0).evaluate((img) => img.complete && img.naturalWidth > 0),
    "immediate valid preview",
  );
  assert.equal(events.length, 0, "choosing a photo for unnamed row must not require a save");
  const firstToken = (await pending()).draft.items[0].pendingPhoto.token;
  assert.ok(JSON.stringify(await pending()).length < 10000, "photo bytes must not fill localStorage");
  await page.reload();
  await preview(0).waitFor();
  await eventually(
    async () => await preview(0).evaluate((img) => img.naturalWidth > 0),
    "preview recovers from IndexedDB",
  );
  assert.equal(events.length, 0);
  await pick(0, png, "wrong.gif", "image/gif");
  await page.getByRole("alert").filter({ hasText: "JPEG" }).waitFor();
  assert.equal((await pending()).draft.items[0].pendingPhoto.token, firstToken);
  await pick(0, Buffer.alloc(2 * 1024 * 1024 + 1));
  await page.getByRole("alert").filter({ hasText: "2 МБ" }).waitFor();
  assert.equal((await pending()).draft.items[0].pendingPhoto.token, firstToken);
  await pick(0);
  await eventually(
    async () => (await pending()).draft.items[0].pendingPhoto.token !== firstToken,
    "replacement before first save",
  );
  await eventually(async () => (await blobCount()) === 1, "replaced file is removed from local storage");
  await page.getByRole("button", { name: "Действия с фото позиции 1", exact: true }).click();
  await page.getByRole("menuitem", { name: "Удалить фото позиции 1", exact: true }).click();
  await page.getByRole("button", { name: "Добавить фото позиции 1", exact: true }).waitFor();
  await eventually(async () => (await blobCount()) === 0, "removing an unsaved photo clears its blob");
  assert.equal(events.length, 0);
  console.log("PASS: unsaved selection, exact 2 MiB file, preview, reload, validation, replacement and removal.");

  await pick(0);
  await preview(0).waitFor();
  await page.getByPlaceholder("Название позиции").fill("Тарелка");
  await page.getByRole("alert").filter({ hasText: "Тестовая ошибка загрузки фото" }).waitFor();
  assert.deepEqual(events, ["PUT", "PHOTO"]);
  assert.equal(inventory.items.length, 1);
  assert.ok((await pending()).draft.items[0].pendingPhoto);
  failPhoto = false;
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  assert.deepEqual(events, ["PUT", "PHOTO", "PHOTO"], "retry should only upload the remaining photo");
  assert.equal(inventory.items.length, 1);
  assert.ok(inventory.items[0].photoUrl);
  assert.equal(await pending(), null);
  await eventually(async () => (await blobCount()) === 0, "successful upload clears local blob");
  await pick(0);
  await eventually(() => photoCount === 2, "existing row still supports direct photo replacement");
  console.log(
    "PASS: automatic row plus photo save, failed upload retention, photo-only retry and existing photo replacement.",
  );

  await add();
  await pick(1);
  await preview(1).waitFor();
  inventory = { ...inventory, version: inventory.version + 1, comment: "Другой менеджер" };
  await page.getByPlaceholder("Название позиции").nth(1).fill("Бокал");
  await page.getByRole("button", { name: "Сложить результаты", exact: true }).click();
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  assert.equal(inventory.items.length, 2);
  assert.ok(inventory.items[1].photoUrl);
  assert.equal(inventory.comment, "Другой менеджер");
  await add();
  await pick(2);
  await preview(2).waitFor();
  await page.getByPlaceholder("Название позиции").nth(2).fill("Чашка");
  const offset = events.length;
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).waitFor();
  assert.equal(inventory.status, "COMPLETED");
  assert.ok(inventory.items.every((item) => item.photoUrl));
  assert.deepEqual(events.slice(offset), ["PUT", "PHOTO", "COMPLETE"]);
  console.log("PASS: selected photo survives a version conflict and completion waits for all photos.");

  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).click();
  await add();
  await pick(3);
  await preview(3).waitFor();
  await page.getByRole("button", { name: "Назад к списку", exact: true }).click();
  await page.getByRole("button", { name: "Выйти без сохранения", exact: true }).click();
  await page.waitForURL("**/inventories/dishware");
  assert.equal(inventory.items.length, 3);
  assert.equal(await pending(), null);
  await eventually(async () => (await blobCount()) === 0, "discard clears queued local photo");
  assert.deepEqual(errors, []);
  console.log("PASS: exit without saving removes the queued photo and does not create a ghost row.");
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
