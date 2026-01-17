export type MasterScheduleMode = "DETAILED" | "COMPACT";

export type PayType = "SALARY" | "HOURLY" | "SHIFT";

export type SalaryHandling = "PRORATE" | "FIXED";

export type MasterScheduleSummaryDto = {
  id: number;
  restaurantId: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  mode: MasterScheduleMode;
  plannedRevenue: number | null;
};

export type MasterScheduleRowDto = {
  id: number;
  positionId: number;
  positionName: string;
  rowIndex: number;
  salaryHandling: SalaryHandling;
  rateOverride: number | null;
  amountOverride: number | null;
  payType: PayType;
  payRate: number | null;
  normHours: number | null;
};

export type MasterScheduleCellDto = {
  id: number;
  rowId: number;
  workDate: string;
  valueRaw: string | null;
  valueNum: number | null;
  unitsCount: number | null;
};

export type MasterScheduleDto = {
  id: number;
  restaurantId: number;
  name: string;
  periodStart: string;
  periodEnd: string;
  mode: MasterScheduleMode;
  plannedRevenue: number | null;
  rows: MasterScheduleRowDto[];
  cells: MasterScheduleCellDto[];
};

export type MasterScheduleCreatePayload = {
  name: string;
  periodStart: string;
  periodEnd: string;
  mode: MasterScheduleMode;
  plannedRevenue?: number | null;
};

export type MasterScheduleUpdatePayload = Partial<MasterScheduleCreatePayload>;

export type MasterScheduleRowCreatePayload = {
  positionId: number;
  salaryHandling?: SalaryHandling;
  rateOverride?: number | null;
  amountOverride?: number | null;
};

export type MasterScheduleRowUpdatePayload = {
  salaryHandling?: SalaryHandling;
  rateOverride?: number | null;
  amountOverride?: number | null;
};

export type MasterScheduleCellUpdatePayload = {
  rowId: number;
  workDate: string;
  valueRaw: string | null;
};

export type MasterScheduleCopyDayPayload = {
  sourceDate: string;
  targetDate: string;
};

export type MasterScheduleCopyWeekPayload = {
  sourceWeekStart: string;
  targetWeekStart: string;
};
