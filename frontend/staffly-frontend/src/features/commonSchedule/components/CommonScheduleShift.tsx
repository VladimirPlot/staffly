import { normalizeCellValue } from "../../schedule/utils/cellFormatting";
import type { ShiftMode } from "../../schedule/types";

export default function CommonScheduleShift({ value, mode }: { value: string; mode: ShiftMode }) {
  const formatted = normalizeCellValue(value, mode) || value.trim();
  const range = mode === "FULL" ? /^(\d{2}:\d{2})-(\d{2}:\d{2})$/.exec(formatted) : null;
  if (!range) return <span>{formatted}</span>;
  return (
    <span aria-label={formatted} className="inline-flex flex-col items-center text-[11px] leading-[11px] tabular-nums">
      <span aria-hidden="true">{range[1]}</span>
      <span aria-hidden="true">-</span>
      <span aria-hidden="true">{range[2]}</span>
    </span>
  );
}
