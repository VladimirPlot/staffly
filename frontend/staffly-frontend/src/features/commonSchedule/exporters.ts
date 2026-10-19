import type { CommonSchedule } from "./api";
import {
  columnLetter,
  createXlsxBlob,
  createZipBlob,
  downloadBlob,
  escapeXml,
  sanitizeFileName,
} from "../schedule/utils/exporters";
import {
  buildCommonExportModel,
  planCommonScheduleImages,
  COMMON_IMAGE_SCALE,
  COMMON_IMAGE_MARGIN,
  COMMON_IMAGE_NAME_WIDTH,
  COMMON_IMAGE_DAY_WIDTH,
  type CommonExportModel,
  type CommonImagePage,
} from "./exportModel";

const styles = `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<fonts count="4"><font><sz val="12"/><name val="Calibri"/></font><font><b/><sz val="12"/><name val="Calibri"/></font><font><sz val="11"/><color rgb="FF71717A"/><name val="Calibri"/></font><font><b/><sz val="20"/><name val="Calibri"/></font></fonts>
<fills count="4"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill><fill><patternFill patternType="solid"><fgColor rgb="FFECFDF5"/><bgColor indexed="64"/></patternFill></fill><fill><patternFill patternType="solid"><fgColor rgb="FFF4F4F5"/><bgColor indexed="64"/></patternFill></fill></fills>
<borders count="2"><border/><border><left style="thin"><color rgb="FFD4D4D8"/></left><right style="thin"><color rgb="FFD4D4D8"/></right><top style="thin"><color rgb="FFD4D4D8"/></top><bottom style="thin"><color rgb="FFD4D4D8"/></bottom></border></borders>
<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>
<cellXfs count="8">
${[
  [0, 0, 1, "center"],
  [0, 0, 1, "left"],
  [1, 2, 1, "center"],
  [1, 2, 1, "left"],
  [2, 3, 1, "center"],
  [3, 0, 0, "center"],
  [2, 0, 0, "center"],
  [2, 0, 1, "left"],
]
  .map(
    ([font, fill, border, align]) =>
      `<xf numFmtId="0" fontId="${font}" fillId="${fill}" borderId="${border}" xfId="0" applyAlignment="1" applyFont="1" applyFill="1" applyBorder="1"><alignment horizontal="${align}" vertical="center" wrapText="1"/></xf>`,
  )
  .join("")}
</cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function commonScheduleSheetXml(model: CommonExportModel): string {
  const lastCol = columnLetter(model.days.length + 1);
  const rows: string[] = [];
  const merges: string[] = [];
  const addRow = (values: string[], height: number, style: (index: number, value: string) => number, merge = false) => {
    const row = rows.length + 1;
    rows.push(
      `<row r="${row}" ht="${height}" customHeight="1">${values
        .map(
          (value, index) =>
            `<c r="${columnLetter(index + 1)}${row}" s="${style(index, value)}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(value)}</t></is></c>`,
        )
        .join("")}</row>`,
    );
    if (merge && model.days.length) merges.push(`<mergeCell ref="A${row}:${lastCol}${row}"/>`);
  };
  addRow([model.title], 40, () => 5, true);
  addRow([model.period], 24, () => 6, true);
  addRow(["Сотрудник / должность", ...model.days.map((day) => day.label)], 34, () => 2);
  for (const group of model.groups) {
    addRow([group.title], 30, () => 3, true);
    if (!group.employees.length) addRow(["В графике нет сотрудников."], 24, () => 7, true);
    for (const employee of group.employees) {
      const nameLines = employee.name
        .split("\n")
        .reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 30)), 0);
      const valueLines = Math.max(...employee.values.map((value) => value.split("\n").length), 1);
      addRow(
        [employee.name, ...employee.values],
        Math.max(58, Math.max(nameLines, valueLines) * 16 + 10),
        (index, value) => (index === 0 ? (employee.historical ? 7 : 1) : value === "—" ? 4 : 0),
      );
    }
  }
  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
<dimension ref="A1:${lastCol}${rows.length}"/>
<sheetViews><sheetView workbookViewId="0"><pane xSplit="1" ySplit="3" topLeftCell="B4" activePane="bottomRight" state="frozen"/></sheetView></sheetViews>
<sheetFormatPr defaultRowHeight="24"/>
<cols><col min="1" max="1" width="36" customWidth="1"/>${model.days.length ? `<col min="2" max="${model.days.length + 1}" width="12" customWidth="1"/>` : ""}</cols>
<sheetData>${rows.join("")}</sheetData>
${merges.length ? `<mergeCells count="${merges.length}">${merges.join("")}</mergeCells>` : ""}
<pageMargins left="0.25" right="0.25" top="0.5" bottom="0.5" header="0.2" footer="0.2"/>
<pageSetup orientation="landscape" paperSize="9"/>
</worksheet>`;
}

export function commonScheduleXlsxBlob(schedule: CommonSchedule): Blob {
  return createXlsxBlob(commonScheduleSheetXml(buildCommonExportModel(schedule)), styles);
}

export function exportCommonScheduleToXlsx(schedule: CommonSchedule): void {
  downloadBlob(commonScheduleXlsxBlob(schedule), sanitizeFileName(schedule.summary.title, "xlsx"));
}

function paintPage(ctx: CanvasRenderingContext2D, page: CommonImagePage, part: number, total: number) {
  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, page.width, page.height);
  const tableWidth = page.width - COMMON_IMAGE_MARGIN * 2;
  let y = COMMON_IMAGE_MARGIN;
  for (const row of page.rows) {
    let x = COMMON_IMAGE_MARGIN;
    row.cells.forEach((lines, index) => {
      const width =
        row.cells.length === 1 ? tableWidth : index === 0 ? COMMON_IMAGE_NAME_WIDTH : COMMON_IMAGE_DAY_WIDTH;
      const isHeading = row.kind === "header" || row.kind === "group";
      ctx.fillStyle = isHeading ? "#ecfdf5" : row.kind === "employee" && lines.join("") === "—" ? "#f4f4f5" : "#ffffff";
      ctx.fillRect(x, y, width, row.height);
      ctx.strokeStyle = "#d4d4d8";
      ctx.lineWidth = 1;
      ctx.strokeRect(x, y, width, row.height);
      ctx.save();
      ctx.beginPath();
      ctx.rect(x + 4, y + 4, width - 8, row.height - 8);
      ctx.clip();
      ctx.fillStyle = row.kind === "period" || (row.historical && index === 0) ? "#71717a" : "#18181b";
      ctx.font = `${row.fontSize}px Arial, sans-serif`;
      const left = (row.kind === "employee" && index === 0) || row.kind === "group" || row.kind === "empty";
      ctx.textAlign = left ? "left" : "center";
      ctx.textBaseline = "middle";
      const lineHeight = row.fontSize + 5;
      lines.forEach((line, lineIndex) =>
        ctx.fillText(
          line,
          left ? x + 12 : x + width / 2,
          y + row.height / 2 + (lineIndex - (lines.length - 1) / 2) * lineHeight,
        ),
      );
      ctx.restore();
      x += width;
    });
    y += row.height;
  }
  if (total > 1) {
    ctx.font = "13px Arial, sans-serif";
    ctx.fillStyle = "#71717a";
    ctx.textAlign = "right";
    ctx.fillText(`Часть ${part} из ${total}`, page.width - COMMON_IMAGE_MARGIN, page.height - COMMON_IMAGE_MARGIN);
  }
}

/** Export from data, independently of screen zoom, sticky headers or scroll position. */
export async function renderCommonScheduleJpegs(schedule: CommonSchedule): Promise<{ filename: string; blob: Blob }[]> {
  await document.fonts?.ready;
  const canvas = document.createElement("canvas");
  const ctx = canvas.getContext("2d");
  if (!ctx) throw new Error("Не удалось создать изображение графика.");
  const pages = planCommonScheduleImages(buildCommonExportModel(schedule), (text, size) => {
    ctx.font = `${size}px Arial, sans-serif`;
    return ctx.measureText(text).width;
  });
  const files: { filename: string; blob: Blob }[] = [];
  try {
    for (const [index, page] of pages.entries()) {
      canvas.width = Math.ceil(page.width * COMMON_IMAGE_SCALE);
      canvas.height = Math.ceil(page.height * COMMON_IMAGE_SCALE);
      ctx.setTransform(COMMON_IMAGE_SCALE, 0, 0, COMMON_IMAGE_SCALE, 0, 0);
      paintPage(ctx, page, index + 1, pages.length);
      const blob = await new Promise<Blob>((resolve, reject) =>
        canvas.toBlob(
          (value) => (value ? resolve(value) : reject(new Error("Не удалось сохранить изображение. Попробуйте XLSX."))),
          "image/jpeg",
          0.98,
        ),
      );
      const suffix = pages.length > 1 ? ` — ${String(index + 1).padStart(2, "0")}` : "";
      files.push({ filename: sanitizeFileName(schedule.summary.title + suffix, "jpg"), blob });
    }
    return files;
  } finally {
    canvas.width = 1;
    canvas.height = 1;
  }
}

export async function exportCommonScheduleToJpeg(schedule: CommonSchedule): Promise<void> {
  const files = await renderCommonScheduleJpegs(schedule);
  if (files.length === 1) {
    downloadBlob(files[0].blob, files[0].filename);
    return;
  }
  const entries = await Promise.all(
    files.map(async (file) => ({ filename: file.filename, data: new Uint8Array(await file.blob.arrayBuffer()) })),
  );
  downloadBlob(createZipBlob(entries), sanitizeFileName(schedule.summary.title, "zip"));
}
