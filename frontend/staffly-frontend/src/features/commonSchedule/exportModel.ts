import type { CommonSchedule } from "./api";
import { daysBetween, formatDayNumber, formatWeekdayShort } from "../schedule/utils/date";
import { normalizeCellValue } from "../schedule/utils/cellFormatting";
import { scheduleRowCellKey } from "../schedule/utils/rowIdentity";
import { formatScheduleDate } from "./utils";

export type CommonExportEmployee = { name: string; values: string[]; historical: boolean };
export type CommonExportModel = {
  title: string;
  period: string;
  days: { date: string; label: string }[];
  groups: { title: string; employees: CommonExportEmployee[] }[];
};

export function buildCommonExportModel(schedule: CommonSchedule): CommonExportModel {
  const { summary, sources } = schedule;
  const days = daysBetween(summary.startDate, summary.endDate);
  return {
    title: summary.title,
    period: `${formatScheduleDate(summary.startDate)} — ${formatScheduleDate(summary.endDate)}`,
    days: days.map((date) => ({ date, label: `${formatDayNumber(date)}\n${formatWeekdayShort(date)}` })),
    groups: sources.map((source) => ({
      title: `${source.title} · ${formatScheduleDate(source.content.config.startDate)} — ${formatScheduleDate(source.content.config.endDate)}`,
      employees: source.content.rows.map((row) => ({
        name: `${row.displayName}\n${row.positionName ?? "Без должности"}${row.historical ? " · История" : ""}`,
        historical: Boolean(row.historical),
        values: days.map((date) => {
          if (date < source.content.config.startDate || date > source.content.config.endDate) return "—";
          const raw = source.content.cellValues[scheduleRowCellKey(row, date)] ?? "";
          const value = normalizeCellValue(raw, source.content.config.shiftMode) || raw.trim();
          const range = source.content.config.shiftMode === "FULL" ? /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(value) : null;
          return range ? `${range[1]}\n-\n${range[2]}` : value;
        }),
      })),
    })),
  };
}

type Measure = (text: string, fontSize: number) => number;
export type CommonImageRow = {
  kind: "title" | "period" | "header" | "group" | "employee" | "empty";
  cells: string[][];
  height: number;
  fontSize: number;
  historical?: boolean;
};
export type CommonImagePage = { rows: CommonImageRow[]; width: number; height: number };
export const COMMON_IMAGE_SCALE = 2;
export const COMMON_IMAGE_MARGIN = 24;
export const COMMON_IMAGE_NAME_WIDTH = 300;
export const COMMON_IMAGE_DAY_WIDTH = 88;

export function wrapExportText(text: string, width: number, measure: (text: string) => number): string[] {
  return text.split(/\r?\n/).flatMap((paragraph) => {
    const lines: string[] = [];
    let line = "";
    for (const char of Array.from(paragraph)) {
      if (line && measure(line + char) > width) {
        lines.push(line);
        line = "";
      }
      line += char;
    }
    lines.push(line);
    return lines;
  });
}

/** Keep high-resolution pages below mobile canvas dimension and memory limits. */
export function planCommonScheduleImages(
  model: CommonExportModel,
  measure: Measure = (text, size) => Array.from(text).length * size * 0.65,
): CommonImagePage[] {
  const tableWidth = COMMON_IMAGE_NAME_WIDTH + model.days.length * COMMON_IMAGE_DAY_WIDTH;
  const width = tableWidth + COMMON_IMAGE_MARGIN * 2;
  const maxHeight = Math.floor(Math.min(8192 / COMMON_IMAGE_SCALE, 16_000_000 / (width * COMMON_IMAGE_SCALE ** 2)));
  const makeRow = (
    kind: CommonImageRow["kind"],
    values: string[],
    fontSize: number,
    minimum: number,
    historical = false,
  ): CommonImageRow => {
    const cells = values.map((text, index) =>
      wrapExportText(
        text,
        (values.length === 1 ? tableWidth : index === 0 ? COMMON_IMAGE_NAME_WIDTH : COMMON_IMAGE_DAY_WIDTH) - 24,
        (value) => measure(value, fontSize),
      ),
    );
    return {
      kind,
      cells,
      fontSize,
      height: Math.max(minimum, Math.max(...cells.map((lines) => lines.length)) * (fontSize + 5) + 20),
      historical,
    };
  };
  const header = [
    makeRow("title", [model.title], 24, 60),
    makeRow("period", [model.period], 15, 40),
    makeRow("header", ["Сотрудник\nДолжность", ...model.days.map((day) => day.label)], 15, 60),
  ];
  const pages: CommonImagePage[] = [];
  const startPage = () => {
    const page = {
      rows: [...header],
      width,
      height: header.reduce((sum, row) => sum + row.height, 0) + COMMON_IMAGE_MARGIN * 2 + 28,
    };
    pages.push(page);
    return page;
  };
  let page = startPage();
  for (const group of model.groups) {
    const groupRow = makeRow("group", [group.title], 16, 42);
    const employees = group.employees.length
      ? group.employees.map((employee) =>
          makeRow("employee", [employee.name, ...employee.values], 15, 78, employee.historical),
        )
      : [makeRow("empty", ["В графике нет сотрудников."], 15, 42)];
    if (page.height + groupRow.height + employees[0].height > maxHeight) page = startPage();
    page.rows.push(groupRow);
    page.height += groupRow.height;
    for (const row of employees) {
      if (page.height + row.height > maxHeight) {
        page = startPage();
        page.rows.push(groupRow);
        page.height += groupRow.height;
      }
      if (page.height + row.height > maxHeight)
        throw new Error("Слишком длинные строки для изображения. Скачайте график в XLSX.");
      page.rows.push(row);
      page.height += row.height;
    }
  }
  return pages;
}
