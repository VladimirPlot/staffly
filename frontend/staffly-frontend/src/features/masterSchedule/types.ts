export type MasterScheduleMode = "DETAILED" | "COMPACT";

export type PayType = "HOURLY" | "SHIFT";

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
  payTypeOverride?: PayType | null;
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
  payTypeOverride?: PayType | null;
};

export type MasterScheduleRowUpdatePayload = {
  salaryHandling?: SalaryHandling;
  rateOverride?: number | null;
  amountOverride?: number | null;
  payTypeOverride?: PayType | null;
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

export type Weekday =
  | "MONDAY"
  | "TUESDAY"
  | "WEDNESDAY"
  | "THURSDAY"
  | "FRIDAY"
  | "SATURDAY"
  | "SUNDAY";

export type MasterScheduleWeekTemplateCellDto = {
  id: number;
  positionId: number;
  weekday: Weekday;
  employeesCount: number | null;
  units: number | null;
};

export type MasterScheduleWeekTemplateUpdatePayload = {
  positionId: number;
  weekday: Weekday;
  employeesCount: number | null;
  units: number | null;
};

export type MasterScheduleWeekTemplatePositionPayload = {
  positionId: number;
};

export type MasterScheduleApplyTemplatePayload = {
  overwriteExisting: boolean;
};
