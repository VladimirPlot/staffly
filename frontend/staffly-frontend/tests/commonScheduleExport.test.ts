import assert from "node:assert/strict";
import test from "node:test";
import React from "react";
import { renderToStaticMarkup } from "react-dom/server";
import "./registerTsx.ts";
import { commonExportFixture } from "./commonScheduleExportFixture.ts";
const { buildCommonExportModel, planCommonScheduleImages, COMMON_IMAGE_SCALE } = await import(
  "../src/features/commonSchedule/exportModel.ts"
);
const { commonScheduleXlsxBlob } = await import("../src/features/commonSchedule/exporters.ts");
const { createZipBlob, sanitizeFileName } = await import("../src/features/schedule/utils/exporters.ts");
const { default: Tabs } = await import("../src/features/schedule/components/SchedulePageTabs.tsx");

async function unzipStored(blob: Blob) {
  const bytes = new Uint8Array(await blob.arrayBuffer());
  const view = new DataView(bytes.buffer);
  const files = new Map<string, Uint8Array>();
  let offset = 0;
  while (view.getUint32(offset, true) === 0x04034b50) {
    assert.equal(view.getUint16(offset + 8, true), 0);
    assert.ok(view.getUint16(offset + 6, true) & 0x0800, "UTF-8 filenames are explicitly marked");
    const size = view.getUint32(offset + 18, true);
    const nameLength = view.getUint16(offset + 26, true);
    const start = offset + 30 + nameLength + view.getUint16(offset + 28, true);
    const name = new TextDecoder().decode(bytes.slice(offset + 30, offset + 30 + nameLength));
    files.set(name, bytes.slice(start, start + size));
    offset = start + size;
  }
  assert.equal(view.getUint32(offset, true), 0x02014b50);
  return files;
}

test("common export keeps source groups, historical identity and periods separate", () => {
  const fixture = commonExportFixture();
  const model = buildCommonExportModel(fixture);
  assert.equal(model.days.length, 31);
  assert.equal(model.groups.length, 2);
  assert.equal(model.groups[0].employees[0].values[0], "09:00\n-\n17:00");
  assert.equal(model.groups[0].employees[1].values[0], "22:00\n-\n06:00");
  assert.equal(model.groups[0].employees[1].historical, true);
  assert.deepEqual(model.groups[1].employees[0].values.slice(0, 5), ["—", "—", "—", "—", "09:30"]);
  fixture.sources[0].content.cellValues["1:2026-10-01"] = "В";
  assert.equal(buildCommonExportModel(fixture).groups[0].employees[0].values[0], "В");
});

test("XLSX is an actual workbook with all groups, escaped text, readable rows and frozen headers", async () => {
  const blob = commonScheduleXlsxBlob(commonExportFixture());
  assert.equal(blob.type, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  const files = await unzipStored(blob);
  assert.equal(files.size, 6);
  const sheet = new TextDecoder().decode(files.get("xl/worksheets/sheet1.xml"));
  assert.match(sheet, /Кухня &amp; зал/);
  assert.match(sheet, /Зал &lt;вечер&gt;/);
  assert.match(sheet, /22:00\n-\n06:00/);
  assert.match(sheet, /История/);
  assert.match(sheet, /state="frozen"/);
  assert.equal((sheet.match(/<row /g) ?? []).length, 9);
  assert.match(sheet, /<dimension ref="A1:AF9"/);
  assert.match(new TextDecoder().decode(files.get("xl/styles.xml")), /wrapText="1"/);
  assert.doesNotMatch(sheet, /<f[ >]/); // user-entered text is never interpreted as a formula
});

test("large JPG exports paginate at high resolution without losing any employees", () => {
  const model = buildCommonExportModel(commonExportFixture(90));
  const pages = planCommonScheduleImages(model);
  assert.ok(pages.length > 1);
  assert.equal(pages.flatMap((page) => page.rows).filter((row) => row.kind === "employee").length, 180);
  for (const page of pages) {
    assert.ok(page.width * page.height * COMMON_IMAGE_SCALE ** 2 <= 16_000_000);
    assert.ok(page.width * COMMON_IMAGE_SCALE <= 8192);
    assert.ok(page.height * COMMON_IMAGE_SCALE <= 8192);
    assert.deepEqual(
      page.rows.slice(0, 3).map((row) => row.kind),
      ["title", "period", "header"],
    );
    assert.equal(page.rows[3].kind, "group");
    assert.notEqual(page.rows.at(-1)?.kind, "group");
    assert.ok(page.rows.filter((row) => row.kind === "employee").every((row) => row.fontSize >= 15));
  }
});

test("small JPG is a single page, while very long names and markers wrap without clipping rows", () => {
  const model = buildCommonExportModel(commonExportFixture());
  assert.equal(planCommonScheduleImages(model).length, 1);
  model.groups[0].employees[0].name = "Очень длинное имя сотрудника ".repeat(30);
  const row = planCommonScheduleImages(model)
    .flatMap((page) => page.rows)
    .find((row) => row.kind === "employee")!;
  assert.ok(row.height > 78);
  assert.equal(row.cells[0].join(""), model.groups[0].employees[0].name.replace(/\n/g, ""));
});

test("ZIP preserves Cyrillic image filenames and image bytes", async () => {
  const image = new Uint8Array([0xff, 0xd8, 0xff, 0xd9]);
  const files = await unzipStored(createZipBlob([{ filename: "Кухня — 01.jpg", data: image }]));
  assert.deepEqual(files.get("Кухня — 01.jpg"), image);
  assert.doesNotMatch(sanitizeFileName("..\\Кухня/Зал:октябрь", "jpg"), /[\\/:]/);
});

test("common schedules have a separate tab for both staff and managers", () => {
  for (const canManage of [true, false]) {
    const html = renderToStaticMarkup(React.createElement(Tabs, { value: "common", canManage, onChange() {} }));
    assert.match(html, /aria-selected="true"[^>]*>Общие графики/);
    assert.match(html, />Графики</);
    assert.equal(html.includes("Шаблоны"), canManage);
  }
});
