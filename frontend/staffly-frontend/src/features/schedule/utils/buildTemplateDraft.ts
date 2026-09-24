import type {
  DayOfWeek,
  SaveScheduleBuildTemplateRequest,
  ScheduleBuildMinRestMode,
  ScheduleBuildTargetPattern,
  ScheduleBuildTemplateDto,
} from "../api";

export type ScheduleBuildShiftOptionDraft = { startTime: string; endTime: string; label: string; sortOrder: number };
export type ScheduleBuildCoverageDateOverrideDraft = { date: string; shiftOptionIndex: number; requiredCount: number };
export type ScheduleBuildCoverageRuleDraft = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
  sortOrder: number;
};

export type ScheduleBuildWeekdayRegimeDraft = {
  key: string;
  daysOfWeek: DayOfWeek[];
  workPeriodStart: string;
  workPeriodEnd: string;
  shiftOptions: ScheduleBuildShiftOptionDraft[];
  coverageRules: ScheduleBuildCoverageRuleDraft[];
  coverageDateOverrides: ScheduleBuildCoverageDateOverrideDraft[];
  sortOrder: number;
};

export type ScheduleBuildPositionConfigDraft = {
  positionIds: number[];
  targetPattern: ScheduleBuildTargetPattern;
  minRestHours: number | "";
  minRestMode: ScheduleBuildMinRestMode;
  maxShiftsPerPeriod: number | "";
  heavyDaysOfWeek: number[];
  sortOrder: number;
  weekdayRegimes: ScheduleBuildWeekdayRegimeDraft[];
  markers: { name: string; memberIds: number[] }[];
};

export type ScheduleBuildTemplateDraft = {
  name: string;
  description: string;
  positionConfigs: ScheduleBuildPositionConfigDraft[];
};

export const SCHEDULE_BUILD_TIME_STEP_SECONDS = 15 * 60;
export const WEEKDAYS: DayOfWeek[] = ["MONDAY", "TUESDAY", "WEDNESDAY", "THURSDAY", "FRIDAY", "SATURDAY", "SUNDAY"];
export const WEEKDAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: "Пн",
  TUESDAY: "Вт",
  WEDNESDAY: "Ср",
  THURSDAY: "Чт",
  FRIDAY: "Пт",
  SATURDAY: "Сб",
  SUNDAY: "Вс",
};
const DAY_NUMBER: Record<DayOfWeek, number> = {
  MONDAY: 1,
  TUESDAY: 2,
  WEDNESDAY: 3,
  THURSDAY: 4,
  FRIDAY: 5,
  SATURDAY: 6,
  SUNDAY: 7,
};
const TIME_MULTIPLE_OF_15_MINUTES_ERROR = "Время должно быть кратно 15 минутам.";
let nextDraftKey = 0;
const draftKey = () => `weekday-regime-${++nextDraftKey}`;

export const canonicalizeWeekdays = (days: readonly DayOfWeek[]): DayOfWeek[] =>
  WEEKDAYS.filter((day) => days.includes(day));

export const validateWeekdayPartition = (regimes: readonly ScheduleBuildWeekdayRegimeDraft[]): string | null => {
  if (regimes.some((regime) => regime.daysOfWeek.length === 0))
    return "Каждый режим должен содержать хотя бы один день";
  const days = regimes.flatMap((regime) => regime.daysOfWeek);
  if (new Set(days).size !== days.length) return "Дни недели в режимах не должны пересекаться";
  if (WEEKDAYS.some((day) => !days.includes(day))) return "Режимы должны покрывать все семь дней недели";
  return null;
};

const weekdayForDate = (date: string): DayOfWeek | null => {
  const parsed = /^\d{4}-\d{2}-\d{2}$/.test(date) ? new Date(`${date}T00:00:00Z`) : null;
  if (!parsed || Number.isNaN(parsed.getTime())) return null;
  const jsDay = parsed.getUTCDay();
  return WEEKDAYS[jsDay === 0 ? 6 : jsDay - 1];
};

const cloneRegime = (
  regime: ScheduleBuildWeekdayRegimeDraft,
  daysOfWeek: DayOfWeek[],
): ScheduleBuildWeekdayRegimeDraft => ({
  ...regime,
  key: draftKey(),
  daysOfWeek: canonicalizeWeekdays(daysOfWeek),
  shiftOptions: regime.shiftOptions.map((item) => ({ ...item })),
  coverageRules: regime.coverageRules.map((item) => ({ ...item })),
  coverageDateOverrides: regime.coverageDateOverrides.map((item) => ({ ...item })),
});

export const splitWeekdayRegime = (
  regimes: readonly ScheduleBuildWeekdayRegimeDraft[],
  index: number,
  selectedDays: readonly DayOfWeek[],
): ScheduleBuildWeekdayRegimeDraft[] => {
  const source = regimes[index];
  if (!source) return [...regimes];
  const selected = canonicalizeWeekdays(selectedDays.filter((day) => source.daysOfWeek.includes(day)));
  if (selected.length === 0) return [...regimes];
  const remaining = canonicalizeWeekdays(source.daysOfWeek.filter((day) => !selected.includes(day)));
  const keep = cloneRegime(source, selected);
  keep.key = source.key;
  keep.coverageRules = keep.coverageRules.filter((item) => selected.some((day) => DAY_NUMBER[day] === item.dayOfWeek));
  keep.coverageDateOverrides = keep.coverageDateOverrides.filter((item) => {
    const day = weekdayForDate(item.date);
    return day === null || selected.includes(day);
  });
  if (remaining.length === 0) return regimes.map((item, itemIndex) => (itemIndex === index ? keep : item));
  const created = cloneRegime(source, remaining);
  created.coverageRules = created.coverageRules.filter((item) =>
    remaining.some((day) => DAY_NUMBER[day] === item.dayOfWeek),
  );
  created.coverageDateOverrides = created.coverageDateOverrides.filter((item) => {
    const day = weekdayForDate(item.date);
    return day !== null && remaining.includes(day);
  });
  return regimes.flatMap((item, itemIndex) => (itemIndex === index ? [keep, created] : [item]));
};

export const deleteWeekdayRegime = (
  regimes: readonly ScheduleBuildWeekdayRegimeDraft[],
  deleteIndex: number,
): ScheduleBuildWeekdayRegimeDraft[] => {
  if (deleteIndex <= 0 || deleteIndex >= regimes.length) return [...regimes];
  const deletedDays = regimes[deleteIndex].daysOfWeek;
  return regimes
    .filter((_, index) => index !== deleteIndex)
    .map((regime, index) =>
      index === 0 ? { ...regime, daysOfWeek: canonicalizeWeekdays([...regime.daysOfWeek, ...deletedDays]) } : regime,
    );
};

export const isTimeMultipleOf15Minutes = (time: string): boolean => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) return false;
  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;
  return (
    hours <= 23 &&
    minutes <= 59 &&
    seconds <= 59 &&
    (hours * 3600 + minutes * 60 + seconds) % SCHEDULE_BUILD_TIME_STEP_SECONDS === 0
  );
};

export const createShiftOptionDraft = (): ScheduleBuildShiftOptionDraft => ({
  startTime: "",
  endTime: "",
  label: "",
  sortOrder: 0,
});
export const createCoverageRuleDraft = (): ScheduleBuildCoverageRuleDraft => ({
  dayOfWeek: 1,
  startTime: "",
  endTime: "",
  requiredCount: 1,
  sortOrder: 0,
});
export const createWeekdayRegimeDraft = (): ScheduleBuildWeekdayRegimeDraft => ({
  key: draftKey(),
  daysOfWeek: [...WEEKDAYS],
  workPeriodStart: "",
  workPeriodEnd: "",
  sortOrder: 0,
  shiftOptions: [createShiftOptionDraft()],
  coverageRules: [],
  coverageDateOverrides: [],
});
export const createPositionConfigDraft = (): ScheduleBuildPositionConfigDraft => ({
  positionIds: [],
  targetPattern: "NONE",
  minRestHours: 12,
  minRestMode: "SOFT",
  maxShiftsPerPeriod: 5,
  heavyDaysOfWeek: [],
  sortOrder: 0,
  weekdayRegimes: [createWeekdayRegimeDraft()],
  markers: [],
});

export const templateDtoToDraft = (template: ScheduleBuildTemplateDto | null): ScheduleBuildTemplateDraft => ({
  name: template?.name ?? "",
  description: template?.description ?? "",
  positionConfigs: template?.positionConfigs?.map((config) => ({
    positionIds: config.positionIds ?? [],
    targetPattern: config.targetPattern,
    minRestHours: config.minRestHours ?? "",
    minRestMode: config.minRestMode ?? "SOFT",
    maxShiftsPerPeriod: config.maxShiftsPerPeriod ?? "",
    heavyDaysOfWeek: [...new Set(config.heavyDaysOfWeek ?? [])]
      .filter((day) => day >= 1 && day <= 7)
      .sort((a, b) => a - b),
    sortOrder: config.sortOrder,
    markers: (config.markers ?? []).map((marker) => ({ name: marker.name, memberIds: [...(marker.memberIds ?? [])] })),
    weekdayRegimes: (config.weekdayRegimes ?? []).map((regime) => ({
      key: draftKey(),
      daysOfWeek: canonicalizeWeekdays(regime.daysOfWeek ?? []),
      workPeriodStart: regime.workPeriodStart,
      workPeriodEnd: regime.workPeriodEnd,
      sortOrder: regime.sortOrder,
      shiftOptions: (regime.shiftOptions ?? []).map((item) => ({ ...item, label: item.label ?? "" })),
      coverageRules: (regime.coverageRules ?? []).map((item) => ({ ...item })),
      coverageDateOverrides: (regime.coverageDateOverrides ?? []).map((item) => ({ ...item })),
    })),
  })) ?? [createPositionConfigDraft()],
});

export const draftToSaveRequest = (draft: ScheduleBuildTemplateDraft): SaveScheduleBuildTemplateRequest => ({
  name: draft.name.trim(),
  description: draft.description.trim() || null,
  positionConfigs: draft.positionConfigs.map((config, index) => ({
    positionIds: [...new Set(config.positionIds)].sort((a, b) => a - b),
    targetPattern: config.targetPattern,
    minRestHours: config.minRestHours === "" ? null : Number(config.minRestHours),
    minRestMode: config.minRestMode,
    maxShiftsPerPeriod: config.maxShiftsPerPeriod === "" ? null : Number(config.maxShiftsPerPeriod),
    heavyDaysOfWeek: [...new Set(config.heavyDaysOfWeek)].filter((day) => day >= 1 && day <= 7).sort((a, b) => a - b),
    sortOrder: index,
    markers: config.markers.map((marker) => ({ name: marker.name, memberIds: [...marker.memberIds] })),
    weekdayRegimes: config.weekdayRegimes.map((regime, regimeIndex) => ({
      daysOfWeek: canonicalizeWeekdays(regime.daysOfWeek),
      workPeriodStart: regime.workPeriodStart,
      workPeriodEnd: regime.workPeriodEnd,
      sortOrder: regimeIndex,
      shiftOptions: regime.shiftOptions.map((item, itemIndex) => ({
        startTime: item.startTime,
        endTime: item.endTime,
        label: item.label.trim() || null,
        sortOrder: itemIndex,
      })),
      coverageRules: regime.coverageRules.map((item, itemIndex) => ({
        ...item,
        dayOfWeek: Number(item.dayOfWeek),
        requiredCount: Number(item.requiredCount) || 0,
        sortOrder: itemIndex,
      })),
      coverageDateOverrides: regime.coverageDateOverrides
        .filter((item) => item.date && item.shiftOptionIndex >= 0 && item.shiftOptionIndex < regime.shiftOptions.length)
        .map((item) => ({ ...item, requiredCount: Number(item.requiredCount) || 0 })),
    })),
  })),
});

export const validateBuildTemplateDraft = (draft: ScheduleBuildTemplateDraft): string | null => {
  if (!draft.name.trim()) return "Укажите название шаблона";
  if (!draft.positionConfigs.length) return "Добавьте хотя бы одну должность";
  const used = new Set<number>();
  for (let i = 0; i < draft.positionConfigs.length; i++) {
    const config = draft.positionConfigs[i];
    if (!config.positionIds.length) return `Укажите хотя бы одну должность #${i + 1}`;
    for (const id of config.positionIds) {
      if (used.has(id)) return "Одна должность не может входить в два блока шаблона";
      used.add(id);
    }
    const partitionError = validateWeekdayPartition(config.weekdayRegimes);
    if (partitionError) return `${partitionError} для должности #${i + 1}`;
    for (const regime of config.weekdayRegimes) {
      if (!regime.workPeriodStart || !regime.workPeriodEnd) return `Укажите рабочий период для должности #${i + 1}`;
      if (!isTimeMultipleOf15Minutes(regime.workPeriodStart) || !isTimeMultipleOf15Minutes(regime.workPeriodEnd))
        return TIME_MULTIPLE_OF_15_MINUTES_ERROR;
      if (!regime.shiftOptions.length) return `Добавьте хотя бы одну смену для должности #${i + 1}`;
      for (const option of regime.shiftOptions)
        if (!option.startTime || !option.endTime) return `Заполните время смены для должности #${i + 1}`;
      for (const option of regime.shiftOptions)
        if (!isTimeMultipleOf15Minutes(option.startTime) || !isTimeMultipleOf15Minutes(option.endTime))
          return TIME_MULTIPLE_OF_15_MINUTES_ERROR;
      for (const override of regime.coverageDateOverrides) {
        if (!override.date) return `Укажите дату исключения для должности #${i + 1}`;
        if (override.requiredCount < 0) return `Количество в исключении не может быть меньше 0 для должности #${i + 1}`;
        const day = weekdayForDate(override.date);
        if (day && !regime.daysOfWeek.includes(day))
          return `Дата исключения должна соответствовать дням режима для должности #${i + 1}`;
      }
      for (const rule of regime.coverageRules) {
        if (!rule.startTime || !rule.endTime) return `Заполните время правила покрытия для должности #${i + 1}`;
        if (!isTimeMultipleOf15Minutes(rule.startTime) || !isTimeMultipleOf15Minutes(rule.endTime))
          return TIME_MULTIPLE_OF_15_MINUTES_ERROR;
        if (!regime.daysOfWeek.some((day) => DAY_NUMBER[day] === rule.dayOfWeek))
          return `Правило покрытия должно соответствовать дням режима для должности #${i + 1}`;
      }
    }
  }
  return null;
};
