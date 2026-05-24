import { z } from "zod";

import { formatDateFromIso, formatDateInput, isValidIsoDate, toIsoDate } from "./date";

export function formatBirthDateInput(value: string): string {
  return formatDateInput(value);
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
  .regex(/^\d{2}\.\d{2}\.\d{4}$/, "Неверный формат даты")
  .refine((value) => {
    const isoDate = toIsoDate(value);
    return isoDate !== undefined && isValidIsoDate(isoDate);
  }, "Введите корректную дату")
  .refine((value) => {
    const isoDate = toIsoDate(value);
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
  return toIsoDate(value) ?? value.trim();
}

export function formatBirthDateFromIso(value: string): string {
  return formatDateFromIso(value);
}
