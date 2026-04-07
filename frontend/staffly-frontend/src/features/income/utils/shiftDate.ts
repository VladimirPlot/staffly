import { z } from "zod";
import { formatDateFromIso, formatDateInput, isValidIsoDate, toIsoDate } from "../../../shared/utils/date";

export function formatShiftDateInput(value: string): string {
  return formatDateInput(value);
}

export function toIsoShiftDate(value: string): string | undefined {
  return toIsoDate(value);
}

const shiftDateSchema = z
  .string()
  .trim()
  .min(1, "Введите дату")
  .regex(/^\d{2}\.\d{2}\.\d{4}$/, "Неверный формат даты")
  .refine((value) => {
    const isoDate = toIsoDate(value);
    return isoDate !== undefined && isValidIsoDate(isoDate);
  }, "Введите корректную дату");

const optionalShiftDateSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || shiftDateSchema.safeParse(value).success, "Введите корректную дату");

export function getShiftDateError(value: string): string | undefined {
  const result = shiftDateSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function getShiftDateDraftError(value: string): string | undefined {
  const result = optionalShiftDateSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function normalizeShiftDateForSubmit(value: string): string {
  return toIsoDate(value) ?? value.trim();
}

export function formatShiftDateFromIso(value: string): string {
  return formatDateFromIso(value);
}
