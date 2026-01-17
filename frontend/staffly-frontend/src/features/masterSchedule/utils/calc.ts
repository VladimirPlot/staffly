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
  let amount = 0;

  if (row.payType === "SALARY") {
    const salaryBase = row.rateOverride ?? row.payRate ?? 0;
    if (row.salaryHandling === "FIXED") {
      amount = salaryBase;
    } else {
      const normHours = row.normHours ?? 0;
      const hourlyRate = normHours > 0 ? salaryBase / normHours : 0;
      amount = hourlyRate * units;
    }
  } else {
    const rate = row.rateOverride ?? row.payRate ?? 0;
    amount = rate * units;
  }

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
  if (row.payType === "SALARY") {
    const salaryBase = row.rateOverride ?? row.payRate ?? 0;
    if (row.salaryHandling === "FIXED") {
      return salaryBase;
    }
    const normHours = row.normHours ?? 0;
    const hourlyRate = normHours > 0 ? salaryBase / normHours : 0;
    return hourlyRate * units;
  }
  const rate = row.rateOverride ?? row.payRate ?? 0;
  return rate * units;
}
