import type {
  DayOfWeek,
  ScheduleBuildPositionConfigDto,
  ScheduleBuildTemplateDto,
  ScheduleBuildWeekdayRegimeDto,
} from "../api";
import { WEEKDAY_LABELS, WEEKDAYS } from "./buildTemplateDraft.ts";

export type WeekdayRegimeIndicator = {
  label: string;
  title: string;
};

const weekdayForBusinessDate = (businessDate: string): DayOfWeek | null => {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(businessDate)) return null;
  const date = new Date(`${businessDate}T00:00:00Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== businessDate) return null;
  const day = date.getUTCDay();
  return WEEKDAYS[day === 0 ? 6 : day - 1] ?? null;
};

const normalizeRegimeDays = (regime: ScheduleBuildWeekdayRegimeDto): DayOfWeek[] | null => {
  if (!Array.isArray(regime.daysOfWeek)) return null;
  const uniqueDays = new Set(regime.daysOfWeek);
  if (uniqueDays.size !== regime.daysOfWeek.length) return null;
  const days = WEEKDAYS.filter((day) => uniqueDays.has(day));
  return days.length === regime.daysOfWeek.length ? days : null;
};

const hasValidMultiRegimePartition = (config: ScheduleBuildPositionConfigDto): boolean => {
  if (!Array.isArray(config.weekdayRegimes) || config.weekdayRegimes.length < 2) return false;
  const occurrences = new Map<DayOfWeek, number>(WEEKDAYS.map((day) => [day, 0]));

  for (const regime of config.weekdayRegimes) {
    const days = normalizeRegimeDays(regime);
    if (!days || days.length === 0) return false;
    days.forEach((day) => occurrences.set(day, (occurrences.get(day) ?? 0) + 1));
  }

  return WEEKDAYS.every((day) => occurrences.get(day) === 1);
};

export const formatWeekdayRegimeLabel = (daysOfWeek: readonly DayOfWeek[]): string | null => {
  const uniqueDays = new Set(daysOfWeek);
  if (uniqueDays.size !== daysOfWeek.length) return null;
  const days = WEEKDAYS.filter((day) => uniqueDays.has(day));
  if (days.length === 0 || days.length !== daysOfWeek.length) return null;

  const labels = days.map((day) => WEEKDAY_LABELS[day]);
  return days.length > 1 && days.every((day, index) => WEEKDAYS.indexOf(day) === WEEKDAYS.indexOf(days[0]) + index)
    ? `${labels[0]}–${labels[labels.length - 1]}`
    : labels.join(", ");
};

export const getWeekdayRegimeIndicator = ({
  template,
  positionId,
  businessDate,
}: {
  template?: ScheduleBuildTemplateDto | null;
  positionId?: number | null;
  businessDate: string;
}): WeekdayRegimeIndicator | null => {
  if (!template || positionId == null || !Array.isArray(template.positionConfigs)) return null;
  const matchingConfigs = template.positionConfigs.filter(
    (config) => Array.isArray(config.positionIds) && config.positionIds.includes(positionId),
  );
  if (matchingConfigs.length !== 1) return null;

  const config = matchingConfigs[0];
  if (!hasValidMultiRegimePartition(config)) return null;
  const weekday = weekdayForBusinessDate(businessDate);
  if (!weekday) return null;
  const matchingRegimes = config.weekdayRegimes.filter((regime) => regime.daysOfWeek.includes(weekday));
  if (matchingRegimes.length !== 1) return null;
  const label = formatWeekdayRegimeLabel(matchingRegimes[0].daysOfWeek);
  if (!label) return null;

  return { label, title: `Для этой даты действует режим ${label}` };
};
