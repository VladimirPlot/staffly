import type { ScheduleData } from "../types";

function sanitizeFileName(name: string, extension: string): string {
  const fallback = "График";
  const trimmed = name?.trim() || fallback;
  const sanitized = trimmed.replace(/[/:*?"<>|]+/g, "_");
  return `${sanitized}.${extension}`;
}

function escapeXml(value: string): string {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&apos;");
}

function columnLetter(index: number): string {
  let dividend = index;
  let columnName = "";
  while (dividend > 0) {
    const modulo = (dividend - 1) % 26;
    columnName = String.fromCharCode(65 + modulo) + columnName;
    dividend = Math.floor((dividend - modulo) / 26);
  }
  return columnName || "A";
}

function createRowXml(rowIndex: number, values: string[]): string {
  const cells = values
    .map((rawValue, columnIndex) => {
      const ref = `${columnLetter(columnIndex + 1)}${rowIndex}`;
      const normalized = rawValue.replace(/\r\n/g, "\n").replace(/\r/g, "\n");
      if (!normalized) {
        return `<c r="${ref}"/>`;
      }
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${escapeXml(normalized)}</t></is></c>`;
    })
    .join("");
  return `<row r="${rowIndex}">${cells}</row>`;
}

function buildSheetXml(schedule: ScheduleData): string {
  const title = schedule.title?.trim() || "График";
  const columnCount = Math.max(1, schedule.days.length + 1);
  const lastColumn = columnLetter(columnCount);
  const lastRow = schedule.rows.length + 3;
  const dimensionRef = `A1:${lastColumn}${Math.max(1, lastRow)}`;

  const rows: string[] = [];
  const firstRow = [title, ...Array(columnCount - 1).fill("")];
  rows.push(createRowXml(1, firstRow));

  const weekdayRow = [
    "",
    ...schedule.days.map((day) => day.weekdayLabel),
  ];
  rows.push(createRowXml(2, weekdayRow));

  const dayRow = [
    "",
    ...schedule.days.map((day) => day.dayNumber),
  ];
  rows.push(createRowXml(3, dayRow));

  schedule.rows.forEach((row, index) => {
    const display = row.positionName
      ? `${row.displayName}
${row.positionName}`
      : row.displayName;
    const values = [
      display,
      ...schedule.days.map((day) => schedule.cellValues[`${row.memberId}:${day.date}`] ?? ""),
    ];
    rows.push(createRowXml(index + 4, values));
  });

  const columns: string[] = [];
  columns.push(`<col min="1" max="1" width="30" customWidth="1"/>`);
  for (let i = 2; i <= columnCount; i += 1) {
    columns.push(`<col min="${i}" max="${i}" width="15" customWidth="1"/>`);
  }

  const mergeRef = `A1:${lastColumn}1`;

  return `<?xml version="1.0" encoding="UTF-8"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <dimension ref="${dimensionRef}"/>
  <sheetViews>
    <sheetView workbookViewId="0"/>
  </sheetViews>
  <sheetFormatPr defaultRowHeight="15"/>
  <cols>
    ${columns.join("\n    ")}
  </cols>
  <sheetData>
    ${rows.join("\n    ")}
  </sheetData>
  <mergeCells count="1">
    <mergeCell ref="${mergeRef}"/>
  </mergeCells>
</worksheet>`;
}

function buildContentTypesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
  <Default Extension="xml" ContentType="application/xml"/>
  <Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
  <Override PartName="/xl/worksheets/sheet1.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>
  <Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>
</Types>`;
}

function buildRootRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`;
}

function buildWorkbookXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
  <sheets>
    <sheet name="График" sheetId="1" r:id="rId1"/>
  </sheets>
</workbook>`;
}

function buildWorkbookRelsXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>
  <Relationship Id="rId2" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>
</Relationships>`;
}

function buildStylesXml(): string {
  return `<?xml version="1.0" encoding="UTF-8"?>
<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">
  <fonts count="1">
    <font>
      <sz val="12"/>
      <color theme="1"/>
      <name val="Calibri"/>
      <family val="2"/>
      <scheme val="minor"/>
    </font>
  </fonts>
  <fills count="1">
    <fill>
      <patternFill patternType="none"/>
    </fill>
  </fills>
  <borders count="1">
    <border>
      <left/>
      <right/>
      <top/>
      <bottom/>
      <diagonal/>
    </border>
  </borders>
  <cellStyleXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0"/>
  </cellStyleXfs>
  <cellXfs count="1">
    <xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/>
  </cellXfs>
</styleSheet>`;
}

function encodeUtf8(content: string): Uint8Array {
  return new TextEncoder().encode(content);
}

type ZipEntry = {
  filename: string;
  data: Uint8Array;
};

const CRC32_TABLE = (() => {
  const table = new Uint32Array(256);
  for (let i = 0; i < 256; i += 1) {
    let c = i;
    for (let k = 0; k < 8; k += 1) {
      if (c & 1) {
        c = 0xedb88320 ^ (c >>> 1);
      } else {
        c >>>= 1;
      }
    }
    table[i] = c >>> 0;
  }
  return table;
})();

function crc32(data: Uint8Array): number {
  let crc = 0xffffffff;
  for (let i = 0; i < data.length; i += 1) {
    const byte = data[i];
    crc = (crc >>> 8) ^ CRC32_TABLE[(crc ^ byte) & 0xff];
  }
  return (crc ^ 0xffffffff) >>> 0;
}

function getDosDateTime(date: Date): { time: number; day: number } {
  let year = date.getFullYear();
  if (year < 1980) {
    year = 1980;
  }
  const dosTime = (date.getHours() << 11) | (date.getMinutes() << 5) | (Math.floor(date.getSeconds() / 2) & 0x1f);
  const dosDate = ((year - 1980) << 9) | ((date.getMonth() + 1) << 5) | date.getDate();
  return { time: dosTime, day: dosDate };
}

function createZip(entries: ZipEntry[]): Uint8Array {
  const encoder = new TextEncoder();
  const localParts: Uint8Array[] = [];
  const centralParts: Uint8Array[] = [];
  let offset = 0;
  const now = new Date();
  const { time, day } = getDosDateTime(now);

  entries.forEach((entry) => {
    const fileNameBytes = encoder.encode(entry.filename);
    const data = entry.data;
    const crc = crc32(data);

    const localHeader = new DataView(new ArrayBuffer(30));
    localHeader.setUint32(0, 0x04034b50, true);
    localHeader.setUint16(4, 20, true);
    localHeader.setUint16(6, 0, true);
    localHeader.setUint16(8, 0, true);
    localHeader.setUint16(10, time, true);
    localHeader.setUint16(12, day, true);
    localHeader.setUint32(14, crc, true);
    localHeader.setUint32(18, data.length, true);
    localHeader.setUint32(22, data.length, true);
    localHeader.setUint16(26, fileNameBytes.length, true);
    localHeader.setUint16(28, 0, true);

    const localChunk = new Uint8Array(30 + fileNameBytes.length);
    localChunk.set(new Uint8Array(localHeader.buffer), 0);
    localChunk.set(fileNameBytes, 30);

    localParts.push(localChunk);
    localParts.push(data);

    const centralHeader = new DataView(new ArrayBuffer(46));
    centralHeader.setUint32(0, 0x02014b50, true);
    centralHeader.setUint16(4, 20, true);
    centralHeader.setUint16(6, 20, true);
    centralHeader.setUint16(8, 0, true);
    centralHeader.setUint16(10, 0, true);
    centralHeader.setUint16(12, time, true);
    centralHeader.setUint16(14, day, true);
    centralHeader.setUint32(16, crc, true);
    centralHeader.setUint32(20, data.length, true);
    centralHeader.setUint32(24, data.length, true);
    centralHeader.setUint16(28, fileNameBytes.length, true);
    centralHeader.setUint16(30, 0, true);
    centralHeader.setUint16(32, 0, true);
    centralHeader.setUint16(34, 0, true);
    centralHeader.setUint16(36, 0, true);
    centralHeader.setUint32(38, 0, true);
    centralHeader.setUint32(42, offset, true);

    const centralChunk = new Uint8Array(46 + fileNameBytes.length);
    centralChunk.set(new Uint8Array(centralHeader.buffer), 0);
    centralChunk.set(fileNameBytes, 46);

    centralParts.push(centralChunk);

    offset += localChunk.length + data.length;
  });

  const centralSize = centralParts.reduce((sum, part) => sum + part.length, 0);
  const totalSize = offset + centralSize + 22;
  const result = new Uint8Array(totalSize);
  let pointer = 0;

  localParts.forEach((part) => {
    result.set(part, pointer);
    pointer += part.length;
  });

  const centralStart = pointer;
  centralParts.forEach((part) => {
    result.set(part, pointer);
    pointer += part.length;
  });

  const endRecord = new DataView(new ArrayBuffer(22));
  endRecord.setUint32(0, 0x06054b50, true);
  endRecord.setUint16(4, 0, true);
  endRecord.setUint16(6, 0, true);
  endRecord.setUint16(8, entries.length, true);
  endRecord.setUint16(10, entries.length, true);
  endRecord.setUint32(12, centralSize, true);
  endRecord.setUint32(16, centralStart, true);
  endRecord.setUint16(20, 0, true);

  result.set(new Uint8Array(endRecord.buffer), pointer);

  return result;
}

function downloadBlob(blob: Blob, fileName: string): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

export function exportScheduleToXlsx(schedule: ScheduleData): void {
  if (typeof document === "undefined") {
    throw new Error("Экспорт доступен только в браузере");
  }
  const entries: ZipEntry[] = [
    { filename: "[Content_Types].xml", data: encodeUtf8(buildContentTypesXml()) },
    { filename: "_rels/.rels", data: encodeUtf8(buildRootRelsXml()) },
    { filename: "xl/workbook.xml", data: encodeUtf8(buildWorkbookXml()) },
    { filename: "xl/_rels/workbook.xml.rels", data: encodeUtf8(buildWorkbookRelsXml()) },
    { filename: "xl/styles.xml", data: encodeUtf8(buildStylesXml()) },
    { filename: "xl/worksheets/sheet1.xml", data: encodeUtf8(buildSheetXml(schedule)) },
  ];

  const zipContent = createZip(entries);
  const buffer = zipContent.buffer as ArrayBuffer;
  const arrayBuffer = buffer.slice(zipContent.byteOffset, zipContent.byteOffset + zipContent.byteLength);
  const blob = new Blob([arrayBuffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  downloadBlob(blob, sanitizeFileName(schedule.title || "График", "xlsx"));
}

type RowOptions = {
  font?: (index: number) => string;
  background?: (index: number) => string;
  align?: (index: number) => CanvasTextAlign;
  color?: (index: number) => string;
  lineHeight?: (index: number) => number;
  padding?: (index: number) => number;
};

function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  width: number,
  height: number,
  align: CanvasTextAlign,
  lineHeight: number,
  padding: number
): void {
  const content = text ? text.split(/\r?\n/) : [""];
  const visibleLines = content.length > 0 ? content : [""];
  const totalHeight = lineHeight * visibleLines.length;
  let currentY = y + height / 2 - totalHeight / 2 + lineHeight / 2;
  const offsetX =
    align === "left" ? x + padding : align === "right" ? x + width - padding : x + width / 2;

  ctx.textAlign = align;
  ctx.textBaseline = "middle";

  visibleLines.forEach((line) => {
    const safeLine = line || "";
    ctx.fillText(safeLine, offsetX, currentY);
    currentY += lineHeight;
  });
}

function drawRow(
  ctx: CanvasRenderingContext2D,
  startX: number,
  startY: number,
  height: number,
  columnWidths: number[],
  values: string[],
  options: RowOptions = {}
): void {
  let currentX = startX;
  values.forEach((value, index) => {
    const width = columnWidths[index] ?? columnWidths[columnWidths.length - 1];
    const background = options.background?.(index) ?? "#ffffff";
    ctx.fillStyle = background;
    ctx.fillRect(currentX, startY, width, height);

    ctx.strokeStyle = "#d4d4d8";
    ctx.lineWidth = 1;
    ctx.strokeRect(currentX, startY, width, height);

    ctx.fillStyle = options.color?.(index) ?? "#09090b";
    ctx.font = options.font?.(index) ?? "14px 'Inter', 'Arial', sans-serif";
    const align = options.align?.(index) ?? (index === 0 ? "left" : "center");
    const padding = options.padding?.(index) ?? (index === 0 ? 16 : 8);
    const lineHeight = options.lineHeight?.(index) ?? 20;

    drawText(ctx, value, currentX, startY, width, height, align, lineHeight, padding);

    currentX += width;
  });
}

export async function exportScheduleToJpeg(schedule: ScheduleData): Promise<void> {
  if (typeof document === "undefined") {
    throw new Error("Экспорт доступен только в браузере");
  }

  const days = schedule.days;
  const columnWidths = [240, ...days.map(() => 120)];
  const baseRowHeight = 56;
  const rowHeights = [64, 40, 36, ...schedule.rows.map(() => baseRowHeight)];
  const totalWidth = columnWidths.reduce((sum, width) => sum + width, 0);
  const totalHeight = rowHeights.reduce((sum, height) => sum + height, 0);
  const margin = 32;

  const canvas = document.createElement("canvas");
  canvas.width = totalWidth + margin * 2;
  canvas.height = totalHeight + margin * 2;
  const ctx = canvas.getContext("2d");
  if (!ctx) {
    throw new Error("Не удалось создать изображение");
  }

  ctx.fillStyle = "#ffffff";
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const originX = margin;
  let currentY = margin;

  const title = schedule.title?.trim() || "График";
  const titleHeight = rowHeights[0];
  ctx.fillStyle = "#f4f4f5";
  ctx.fillRect(originX, currentY, totalWidth, titleHeight);
  ctx.strokeStyle = "#d4d4d8";
  ctx.lineWidth = 1;
  ctx.strokeRect(originX, currentY, totalWidth, titleHeight);
  ctx.fillStyle = "#09090b";
  ctx.font = "600 20px 'Inter', 'Arial', sans-serif";
  ctx.textAlign = "center";
  ctx.textBaseline = "middle";
  ctx.fillText(title, originX + totalWidth / 2, currentY + titleHeight / 2);

  currentY += titleHeight;

  drawRow(
    ctx,
    originX,
    currentY,
    rowHeights[1],
    columnWidths,
    ["", ...days.map((day) => day.weekdayLabel)],
    {
      background: (index) => (index === 0 ? "#ffffff" : "#f4f4f5"),
      font: () => "600 14px 'Inter', 'Arial', sans-serif",
      lineHeight: () => 18,
    }
  );

  currentY += rowHeights[1];

  drawRow(
    ctx,
    originX,
    currentY,
    rowHeights[2],
    columnWidths,
    ["", ...days.map((day) => day.dayNumber)],
    {
      font: (index) => (index === 0 ? "12px 'Inter', 'Arial', sans-serif" : "14px 'Inter', 'Arial', sans-serif"),
      lineHeight: () => 18,
    }
  );

  currentY += rowHeights[2];

  schedule.rows.forEach((row, rowIndex) => {
    const label = row.positionName
      ? `${row.displayName}
${row.positionName}`
      : row.displayName;
    const values = [
      label,
      ...days.map((day) => schedule.cellValues[`${row.memberId}:${day.date}`] ?? ""),
    ];
    drawRow(
      ctx,
      originX,
      currentY,
      rowHeights[rowIndex + 3],
      columnWidths,
      values,
      {
        font: (index) => (index === 0 ? "14px 'Inter', 'Arial', sans-serif" : "14px 'Inter', 'Arial', sans-serif"),
        background: () => (rowIndex % 2 === 0 ? "#ffffff" : "#f9fafb"),
        lineHeight: () => 20,
        padding: (index) => (index === 0 ? 18 : 12),
      }
    );
    currentY += rowHeights[rowIndex + 3];
  });

  const dataUrl = canvas.toDataURL("image/jpeg", 0.95);
  const link = document.createElement("a");
  link.href = dataUrl;
  link.download = sanitizeFileName(schedule.title || "График", "jpg");
  link.style.display = "none";
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
}
