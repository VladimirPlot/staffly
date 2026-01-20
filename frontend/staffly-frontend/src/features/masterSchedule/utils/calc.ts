import type { MasterScheduleCellDto, MasterScheduleRowDto } from "../types";

export function normalizeCellValue(cell?: MasterScheduleCellDto): number {
  if (!cell || cell.valueNum == null) return 0;
  if (cell.unitsCount != null) {
    return cell.unitsCount * cell.valueNum;
  }
  return cell.valueNum ?? 0;
}

export function calcRowAmount(
  row: MasterScheduleRowDto,
  rowCells: MasterScheduleCellDto[]
): { units: number; amount: number } {
  const units = rowCells.reduce((sum, cell) => sum + normalizeCellValue(cell), 0);
  const rate = row.rateOverride ?? row.payRate ?? 0;
  let amount = rate * units;

  if (row.amountOverride != null) {
    amount = row.amountOverride;
  }

  return { units, amount };
}

export function calcCellAmount(
  row: MasterScheduleRowDto,
  cell?: MasterScheduleCellDto
): number {
  if (!cell) return 0;
  const units = normalizeCellValue(cell);
  const rate = row.rateOverride ?? row.payRate ?? 0;
  return rate * units;
}
