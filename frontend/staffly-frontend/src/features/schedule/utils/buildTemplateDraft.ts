import type { SaveScheduleBuildTemplateRequest, ScheduleBuildTargetPattern, ScheduleBuildTemplateDto } from "../api";

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
    if (!config.fullShiftStart || !config.fullShiftEnd) return `Укажите полную смену для должности #${i + 1}`;
    if ((config.shiftOptions ?? []).length === 0) return `Добавьте хотя бы одну смену для должности #${i + 1}`;
    for (const option of config.shiftOptions) {
      if (!option.startTime || !option.endTime) return `Заполните время смены для должности #${i + 1}`;
    }
  }

  return null;
};
