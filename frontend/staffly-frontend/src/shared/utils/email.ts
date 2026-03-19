import { z } from "zod";

export const EMAIL_MAX_LENGTH = 255;

const emailSchema = z
  .string()
  .trim()
  .min(1, "Введите email")
  .max(EMAIL_MAX_LENGTH, `Email не должен превышать ${EMAIL_MAX_LENGTH} символов`)
  .email("Введите корректный email");

const optionalEmailSchema = z
  .string()
  .trim()
  .refine((value) => value === "" || emailSchema.safeParse(value).success, "Введите корректный email");

export function getEmailError(value: string): string | undefined {
  const result = emailSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function getEmailDraftError(value: string): string | undefined {
  const result = optionalEmailSchema.safeParse(value);
  return result.success ? undefined : result.error.issues[0]?.message;
}

export function isEmailValid(value: string): boolean {
  return emailSchema.safeParse(value).success;
}
