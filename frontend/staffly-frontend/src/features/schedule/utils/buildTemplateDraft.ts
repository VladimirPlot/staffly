import type {
  SaveScheduleBuildTemplateRequest,
  ScheduleBuildMinRestMode,
  ScheduleBuildTargetPattern,
  ScheduleBuildTemplateDto,
} from "../api";

export type ScheduleBuildShiftOptionDraft = {
  startTime: string;
  endTime: string;
  label: string;
  isFullShift: boolean;
  sortOrder: number;
};

export type ScheduleBuildCoverageRuleDraft = {
  dayOfWeek: number;
  startTime: string;
  endTime: string;
  requiredCount: number;
  sortOrder: number;
};

export type ScheduleBuildPositionConfigDraft = {
  positionId: number | "";
  fullShiftStart: string;
  fullShiftEnd: string;
  targetPattern: ScheduleBuildTargetPattern;
  minRestHours: number | "";
  minRestMode: ScheduleBuildMinRestMode;
  maxShiftsPerPeriod: number | "";
  sortOrder: number;
  shiftOptions: ScheduleBuildShiftOptionDraft[];
  coverageRules: ScheduleBuildCoverageRuleDraft[];
};

export type ScheduleBuildTemplateDraft = {
  name: string;
  description: string;
  positionConfigs: ScheduleBuildPositionConfigDraft[];
};

export const SCHEDULE_BUILD_TIME_STEP_SECONDS = 15 * 60;

const TIME_MULTIPLE_OF_15_MINUTES_ERROR = "Время должно быть кратно 15 минутам.";

export const isTimeMultipleOf15Minutes = (time: string): boolean => {
  const match = /^(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(time);
  if (!match) return false;

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;

  if (hours > 23 || minutes > 59 || seconds > 59) return false;

  return (hours * 60 * 60 + minutes * 60 + seconds) % SCHEDULE_BUILD_TIME_STEP_SECONDS === 0;
};

export const createShiftOptionDraft = (): ScheduleBuildShiftOptionDraft => ({
  startTime: "",
  endTime: "",
  label: "",
  isFullShift: false,
  sortOrder: 0,
});

export const createCoverageRuleDraft = (): ScheduleBuildCoverageRuleDraft => ({
  dayOfWeek: 1,
  startTime: "",
  endTime: "",
  requiredCount: 1,
  sortOrder: 0,
});

export const createPositionConfigDraft = (): ScheduleBuildPositionConfigDraft => ({
  positionId: "",
  fullShiftStart: "",
  fullShiftEnd: "",
  targetPattern: "NONE",
  minRestHours: 12,
  minRestMode: "SOFT",
  maxShiftsPerPeriod: 5,
  sortOrder: 0,
  shiftOptions: [createShiftOptionDraft()],
  coverageRules: [],
});

export const templateDtoToDraft = (template: ScheduleBuildTemplateDto | null): ScheduleBuildTemplateDraft => ({
  name: template?.name ?? "",
  description: template?.description ?? "",
  positionConfigs: template?.positionConfigs?.map((config) => ({
    positionId: config.positionId,
    fullShiftStart: config.fullShiftStart,
    fullShiftEnd: config.fullShiftEnd,
    targetPattern: config.targetPattern,
    minRestHours: config.minRestHours ?? "",
    minRestMode: config.minRestMode ?? "SOFT",
    maxShiftsPerPeriod: config.maxShiftsPerPeriod ?? "",
    sortOrder: config.sortOrder,
    shiftOptions: (config.shiftOptions ?? []).map((option) => ({
      startTime: option.startTime,
      endTime: option.endTime,
      label: option.label ?? "",
      isFullShift: option.isFullShift,
      sortOrder: option.sortOrder,
    })),
    coverageRules: (config.coverageRules ?? []).map((rule) => ({
      dayOfWeek: rule.dayOfWeek,
      startTime: rule.startTime,
      endTime: rule.endTime,
      requiredCount: rule.requiredCount,
      sortOrder: rule.sortOrder,
    })),
  })) ?? [createPositionConfigDraft()],
});

export const draftToSaveRequest = (draft: ScheduleBuildTemplateDraft): SaveScheduleBuildTemplateRequest => ({
  name: draft.name.trim(),
  description: draft.description.trim() ? draft.description.trim() : null,
  positionConfigs: draft.positionConfigs.map((config, index) => ({
    positionId: Number(config.positionId),
    fullShiftStart: config.fullShiftStart,
    fullShiftEnd: config.fullShiftEnd,
    targetPattern: config.targetPattern,
    minRestHours: config.minRestHours === "" ? null : Number(config.minRestHours),
    minRestMode: config.minRestMode,
    maxShiftsPerPeriod: config.maxShiftsPerPeriod === "" ? null : Number(config.maxShiftsPerPeriod),
    sortOrder: index,
    shiftOptions: config.shiftOptions.map((option, optionIndex) => ({
      startTime: option.startTime,
      endTime: option.endTime,
      label: option.label?.trim() ? option.label.trim() : null,
      isFullShift: option.isFullShift,
      sortOrder: optionIndex,
    })),
    coverageRules: config.coverageRules.map((rule, ruleIndex) => ({
      dayOfWeek: Number(rule.dayOfWeek),
      startTime: rule.startTime,
      endTime: rule.endTime,
      requiredCount: Number(rule.requiredCount) || 0,
      sortOrder: ruleIndex,
    })),
  })),
});

export const validateBuildTemplateDraft = (draft: ScheduleBuildTemplateDraft): string | null => {
  if (!draft.name.trim()) return "Укажите название шаблона";
  if (draft.positionConfigs.length === 0) return "Добавьте хотя бы одну должность";

  for (let i = 0; i < draft.positionConfigs.length; i++) {
    const config = draft.positionConfigs[i];
    if (!config.positionId) return `Укажите должность #${i + 1}`;
    if (!config.fullShiftStart || !config.fullShiftEnd) return `Укажите рабочий диапазон для должности #${i + 1}`;
    if (!isTimeMultipleOf15Minutes(config.fullShiftStart) || !isTimeMultipleOf15Minutes(config.fullShiftEnd)) {
      return TIME_MULTIPLE_OF_15_MINUTES_ERROR;
    }
    if ((config.shiftOptions ?? []).length === 0) return `Добавьте хотя бы одну смену для должности #${i + 1}`;
    for (const option of config.shiftOptions) {
      if (!option.startTime || !option.endTime) return `Заполните время смены для должности #${i + 1}`;
      if (!isTimeMultipleOf15Minutes(option.startTime) || !isTimeMultipleOf15Minutes(option.endTime)) {
        return TIME_MULTIPLE_OF_15_MINUTES_ERROR;
      }
    }
    for (const rule of config.coverageRules) {
      if (!rule.startTime || !rule.endTime) return `Заполните время правила покрытия для должности #${i + 1}`;
      if (!isTimeMultipleOf15Minutes(rule.startTime) || !isTimeMultipleOf15Minutes(rule.endTime)) {
        return TIME_MULTIPLE_OF_15_MINUTES_ERROR;
      }
    }
  }

  return null;
};
