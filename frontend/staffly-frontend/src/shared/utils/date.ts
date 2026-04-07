export function formatDateInput(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 8);
  const day = digits.slice(0, 2);
  const month = digits.slice(2, 4);
  const year = digits.slice(4, 8);

  if (digits.length <= 2) {
    return day;
  }

  if (digits.length <= 4) {
    return `${day}.${month}`;
  }

  return `${day}.${month}.${year}`;
}

export function toIsoDate(value: string): string | undefined {
  const trimmed = value.trim();
  const parts = trimmed.split(/[.-]/);

  if (parts.length !== 3) {
    return undefined;
  }

  const [day, month, year] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return undefined;
  }

  return `${year}-${month}-${day}`;
}

export function isValidIsoDate(value: string): boolean {
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

export function formatDateFromIso(value: string): string {
  const trimmed = value.trim();
  const parts = trimmed.split("-");

  if (parts.length !== 3) {
    return trimmed;
  }

  const [year, month, day] = parts;
  if (day.length !== 2 || month.length !== 2 || year.length !== 4) {
    return trimmed;
  }

  return `${day}.${month}.${year}`;
}
