// Real mobile components and gestures; synthetic API/storage only.
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
  const context = await browser.newContext({ viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true });
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
    totalLossQty: 0,
    totalLossAmount: 0,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString(),
    items: [
      {
        id: 10,
        clientKey: "plate",
        name: "Тарелка глубокая с широкими краями для подачи горячих блюд, коллекция ресторана",
        previousQty: 10,
        incomingQty: 2,
        currentQty: 8,
        unitPrice: 50,
        sortOrder: 0,
        photoUrl: `${baseUrl}/photo/preview.png`,
        originalPhotoUrl: `${baseUrl}/photo/full.png`,
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
  let nextId = 100,
    uploads = 0,
    writes = 0,
    failPhoto = true,
    originalRequests = 0;
  let image;
  await context.route("**/photo/**", (route) => {
    if (route.request().url().includes("full")) originalRequests++;
    return route.fulfill({ body: image, contentType: "image/png" });
  });
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
      const body = req.postDataJSON();
      writes++;
      assert.equal(body.expectedVersion, inventory.version);
      inventory = {
        ...inventory,
        ...body,
        version: inventory.version + 1,
        items: body.items.map((row) => ({
          ...inventory.items.find((old) => old.clientKey === row.clientKey),
          ...row,
          id: row.id ?? nextId++,
        })),
      };
      return respond(inventory);
    }
    const item = path.match(/\/items\/(\d+)\/image$/);
    if (item) {
      const row = inventory.items.find((row) => row.id === Number(item[1]));
      assert.ok(row);
      if (req.method() === "DELETE") {
        row.photoUrl = null;
        row.originalPhotoUrl = null;
        inventory.version++;
        return respond(inventory);
      }
      uploads++;
      const body = req.postDataBuffer().toString("latin1");
      assert.ok(body.includes('name="originalFile"'), "both files must be uploaded atomically");
      assert.ok(body.includes("photo-full.jpg"));
      assert.ok(body.includes("photo-preview.jpg"));
      assert.equal(Number(body.match(/name="expectedVersion"\r\n\r\n(\d+)/)?.[1]), inventory.version);
      if (failPhoto) return respond({ message: "Повторите загрузку фото" }, 503);
      row.photoUrl = `${baseUrl}/photo/${row.id}-preview.png`;
      row.originalPhotoUrl = `${baseUrl}/photo/${row.id}-full.png`;
      inventory.version++;
      return respond(inventory);
    }
    if (path.endsWith("/complete")) {
      inventory = { ...inventory, status: "COMPLETED", version: inventory.version + 1 };
      return respond(inventory);
    }
    if (path.endsWith("/dishware/3")) return respond(inventory);
    if (path.includes("unread")) return respond({ count: 0 });
    return respond([]);
  });
  const page = await context.newPage(),
    errors = [];
  page.on("pageerror", (error) => errors.push(error.message));
  await page.goto(baseUrl);
  image = Buffer.from(
    await page.evaluate(() => {
      const canvas = document.createElement("canvas");
      canvas.width = 1200;
      canvas.height = 800;
      const ctx = canvas.getContext("2d");
      ctx.fillStyle = "#dc2626";
      ctx.fillRect(0, 0, 600, 800);
      ctx.fillStyle = "#2563eb";
      ctx.fillRect(600, 0, 600, 800);
      ctx.fillStyle = "white";
      ctx.font = "60px sans-serif";
      ctx.fillText("ORIGINAL 1200 x 800", 180, 400);
      return canvas.toDataURL("image/png").split(",")[1];
    }),
    "base64",
  );
  await page.goto(`${baseUrl}/inventories/dishware/3`);
  const list = page.getByRole("list", { name: "Мобильный подсчёт посуды", exact: true });
  await list.waitFor();
  const row = (index) => list.getByRole("listitem").nth(index);
  const count = (index) => page.getByRole("textbox", { name: `Стало, позиция ${index + 1}`, exact: true });
  const pending = () =>
    page.evaluate(() => JSON.parse(localStorage.getItem("staffly:dishware-draft:v1:1:2:3") || "null"));
  for (const width of [390, 320]) {
    await page.setViewportSize({ width, height: 844 });
    assert.equal(await list.evaluate((node) => node.scrollWidth <= node.clientWidth), true);
    for (let index = 0; index < 2; index++) {
      const bounds = await count(index).boundingBox();
      assert.ok(bounds.x >= 0 && bounds.x + bounds.width <= width);
    }
    const name = row(0).getByRole("button", { name: "Название, позиция 1", exact: true }).locator("span");
    assert.ok(
      await name.evaluate((node) => node.clientHeight <= 60 && parseFloat(getComputedStyle(node).fontSize) >= 12),
    );
  }
  await page.setViewportSize({ width: 390, height: 844 });
  await count(0).fill("12");
  await count(0).press("Enter");
  assert.equal(await count(1).evaluate((node) => node === document.activeElement), true);
  await count(1).fill("3");
  await count(1).press("Enter");
  await eventually(
    () => inventory.items[0].currentQty === 12 && inventory.items[1].currentQty === 3,
    "counts autosave",
  );
  await row(0).getByRole("button", { name: "Название, позиция 1", exact: true }).click();
  const nameDialog = page.getByRole("dialog", { name: "Изменить название", exact: true });
  await nameDialog.getByLabel("Название позиции").fill("ДлинноеНазвание".repeat(14));
  await nameDialog.getByRole("button", { name: "Готово", exact: true }).click();
  await eventually(() => inventory.items[0].name.startsWith("Длинное"), "name autosaves");
  assert.equal(
    await row(0)
      .getByRole("button", { name: "Название, позиция 1", exact: true })
      .locator("span")
      .evaluate((node) => parseFloat(getComputedStyle(node).fontSize)),
    12,
  );
  assert.equal(originalRequests, 0, "full images are not downloaded for thumbnails");
  await row(0).getByRole("button", { name: "Открыть фото позиции 1", exact: true }).click();
  let viewer = page.getByRole("dialog");
  await viewer.locator('img[src*="/photo/full.png"]').waitFor();
  await eventually(() => originalRequests === 1, "original is loaded on demand");
  const slider = () => viewer.getByRole("slider", { name: "Масштаб фото", exact: true });
  await viewer.getByRole("button", { name: "Увеличить фото", exact: true }).click();
  assert.ok(Number(await slider().inputValue()) > 1);
  await slider().fill("2");
  const region = () => viewer.getByRole("region");
  await region().evaluate((node) =>
    node.dispatchEvent(new WheelEvent("wheel", { deltaY: -25, ctrlKey: true, bubbles: true, cancelable: true })),
  );
  assert.ok(Number(await slider().inputValue()) > 2);
  await slider().fill("1");
  const session = await context.newCDPSession(page);
  async function pinch(target) {
    const box = await target.boundingBox(),
      x = box.x + box.width / 2,
      y = box.y + box.height / 2;
    await session.send("Input.dispatchTouchEvent", {
      type: "touchStart",
      touchPoints: [
        { x: x - 20, y, id: 1 },
        { x: x + 20, y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", {
      type: "touchMove",
      touchPoints: [
        { x: x - 45, y, id: 1 },
        { x: x + 45, y, id: 2 },
      ],
    });
    await session.send("Input.dispatchTouchEvent", { type: "touchEnd", touchPoints: [] });
  }
  await pinch(region());
  await eventually(async () => Number(await slider().inputValue()) > 1.5, "two-finger zoom works");
  await viewer.getByRole("button", { name: "Закрыть фото", exact: true }).click();
  assert.equal(await row(0).getByRole("button", { name: "Действия с фото позиции 1", exact: true }).count(), 0);
  await row(0).getByRole("button", { name: "Детали", exact: false }).click();
  await row(0).getByRole("textbox", { name: "Цена, позиция 1", exact: true }).fill("55");
  await eventually(() => inventory.items[0].unitPrice === 55, "price edit in details");
  if (process.env.STAFFLY_TEST_SCREENSHOT) await list.screenshot({ path: process.env.STAFFLY_TEST_SCREENSHOT });
  console.log(
    "PASS: 320/390px counting without horizontal scroll, bounded names, numeric next, details, lazy original and touch/trackpad zoom.",
  );

  await page.getByRole("button", { name: "Добавить позицию", exact: true }).first().click();
  const pick = () =>
    row(2).locator("input[type=file]").setInputFiles({ name: "plate.png", mimeType: "image/png", buffer: image });
  const crop = () => page.getByRole("dialog", { name: "Подготовить фото позиции", exact: true });
  await pick();
  await crop().waitFor();
  await crop().getByRole("button", { name: "Отмена", exact: true }).click();
  assert.ok(!(await pending()).draft.items[2].pendingPhoto);
  await pick();
  await crop().getByRole("slider", { name: "Масштаб изображения", exact: true }).fill("1.5");
  await pinch(crop().getByRole("region", { name: "Кадрирование фото", exact: true }));
  assert.ok(Number(await crop().getByRole("slider").inputValue()) > 1.5);
  await crop().getByRole("button", { name: "Сохранить", exact: true }).click();
  await crop().waitFor({ state: "hidden" });
  const descriptor = (await pending()).draft.items[2].pendingPhoto;
  assert.ok(descriptor.original);
  await page.reload();
  await list.waitFor();
  assert.equal((await pending()).draft.items[2].pendingPhoto.token, descriptor.token);
  await row(2).getByRole("button", { name: "Открыть фото позиции 3", exact: true }).click();
  viewer = page.getByRole("dialog");
  await eventually(
    async () =>
      await viewer.locator("img").evaluate((node) => node.naturalWidth === 1200 && node.naturalHeight === 800),
    "restored local full photo keeps original framing and resolution",
  );
  await viewer.getByRole("button", { name: "Удалить фото", exact: true }).click();
  assert.ok(!(await pending()).draft.items[2].pendingPhoto);
  await pick();
  await crop().getByRole("button", { name: "Сохранить", exact: true }).click();
  await crop().waitFor({ state: "hidden" });
  await row(2).getByRole("button", { name: "Название, позиция 3", exact: true }).click();
  await nameDialog.getByLabel("Название позиции").fill("Чашка");
  await nameDialog.getByRole("button", { name: "Готово", exact: true }).click();
  await page.getByRole("alert").filter({ hasText: "Повторите загрузку фото" }).waitFor();
  assert.ok((await pending()).draft.items[2].pendingPhoto.original);
  const beforeRetry = writes;
  failPhoto = false;
  await page.getByRole("button", { name: "Сохранить", exact: true }).click();
  await page.getByText("Все изменения сохранены", { exact: true }).waitFor();
  assert.equal(writes, beforeRetry);
  assert.equal(uploads, 2);
  assert.ok(inventory.items[2].originalPhotoUrl);
  await row(2).getByRole("button", { name: "Открыть фото позиции 3", exact: true }).click();
  await viewer.locator('img[src*="-full.png"]').waitFor();
  await viewer.getByRole("button", { name: "Заменить фото", exact: true }).waitFor();
  await page
    .getByLabel("Заменить открытое фото")
    .setInputFiles({ name: "bad.gif", mimeType: "image/gif", buffer: image });
  await viewer.getByRole("alert").filter({ hasText: "JPEG" }).waitFor();
  assert.ok(inventory.items[2].originalPhotoUrl);
  await page
    .getByLabel("Заменить открытое фото")
    .setInputFiles({ name: "replace.png", mimeType: "image/png", buffer: image });
  await crop().waitFor();
  await crop().getByRole("button", { name: "Отмена", exact: true }).click();
  assert.ok(inventory.items[2].originalPhotoUrl);
  await page.getByRole("button", { name: "Завершить", exact: true }).click();
  await page.getByRole("button", { name: "Вернуть в черновик", exact: true }).waitFor();
  await row(2).getByRole("button", { name: "Открыть фото позиции 3", exact: true }).click();
  await viewer.getByRole("slider", { name: "Масштаб фото", exact: true }).waitFor();
  assert.equal(await viewer.getByRole("button", { name: "Удалить фото", exact: true }).count(), 0);
  await viewer.getByRole("button", { name: "Закрыть фото", exact: true }).click();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.locator("table").waitFor();
  assert.equal(await list.count(), 0);
  assert.equal(await page.locator("tbody tr").count(), 3);
  assert.deepEqual(errors, []);
  console.log(
    "PASS: crop confirmation/cancellation, local full-photo recovery, viewer delete/replace, atomic pair upload retry, read-only viewing and desktop table.",
  );
})()
  .catch((error) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await browser?.close();
  });
