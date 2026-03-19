import { z } from "zod";

export function formatBirthDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  if (digits.length <= 2) {
    return day;
  }
  if (digits.length <= 4) {
    return `${day}-${month}`;
  }
  return `${day}-${month}-${year}`;
}

function toIsoBirthDate(value: string): string | undefined {
  const trimmed = value.trim();
  const parts = trimmed.split("-");

  if (parts.length !== 3) {
    return undefined;
  }

  const [day, month, year] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

function isValidIsoDate(value: string): boolean {
  const [year, month, day] = value.split("-").map(Number);
  if (!year || !month || !day) {
    return false;
  }

  const date = new Date(Date.UTC(year, month - 1, day));
  return (
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month - 1 &&
    date.getUTCDate() === day
  );
}

function isTodayOrPastIsoDate(value: string): boolean {
  const today = new Date();
  const todayIso = [
    today.getUTCFullYear(),
    String(today.getUTCMonth() + 1).padStart(2, "0"),
    String(today.getUTCDate()).padStart(2, "0"),
  ].join("-");

  return value <= todayIso;
}

const birthDateSchema = z
  .string()
  .trim()
  .min(1, "Введите дату рождения")
  .regex(/^\d{2}-\d{2}-\d{4}$/, "Неверный формат даты")
  .refine((value) => {
    const isoDate = toIsoBirthDate(value);
    return isoDate !== undefined && isValidIsoDate(isoDate);
  }, "Введите корректную дату")
  .refine((value) => {
    const isoDate = toIsoBirthDate(value);
    return isoDate !== undefined && isTodayOrPastIsoDate(isoDate);
  }, "Дата рождения не может быть в будущем");

const optionalBirthDateSchema = z
  .string()
  .trim()
  .refine(
    (value) => value === "" || birthDateSchema.safeParse(value).success,
    "Введите корректную дату рождения",
  );

export function getBirthDateError(value: string): string | undefined {
  const result = birthDateSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function getBirthDateDraftError(value: string): string | undefined {
  const result = optionalBirthDateSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function isBirthDateValid(value: string): boolean {
  return birthDateSchema.safeParse(value).success;
}

export function normalizeBirthDateForSubmit(value: string): string {
  return toIsoBirthDate(value) ?? value.trim();
}

export function formatBirthDateFromIso(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split("-");

  if (parts.length !== 3) {
    return trimmed;
  }

  const [year, month, day] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return trimmed;
  }

  return `${day}-${month}-${year}`;
}
