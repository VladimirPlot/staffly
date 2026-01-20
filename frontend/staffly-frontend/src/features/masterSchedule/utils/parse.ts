const MULTIPLY_PATTERN = /^\s*(\d+(?:[.,]\d+)?)\s*[x*×]\s*(\d+(?:[.,]\d+)?)\s*$/i;

export type ParsedCellValue = {
  valueNum: number | null;
  unitsCount: number | null;
  error?: string;
};

export function parseCellValue(raw: string | null): ParsedCellValue {
  if (!raw || !raw.trim()) {
    return { valueNum: null, unitsCount: null };
  }
  const normalized = raw.trim().replace(",", ".");
  const match = normalized.match(MULTIPLY_PATTERN);
  if (match) {
    const units = Number(match[1]);
    const value = Number(match[2]);
    if (!Number.isFinite(units) || !Number.isFinite(value)) {
      return { valueNum: null, unitsCount: null, error: "Некорректное значение" };
    }
    if (!Number.isInteger(units)) {
      return { valueNum: null, unitsCount: null, error: "Количество должно быть целым" };
    }
    return { valueNum: value, unitsCount: units };
  }

  const value = Number(normalized);
  if (!Number.isFinite(value)) {
    return { valueNum: null, unitsCount: null, error: "Некорректное значение" };
  }

  return { valueNum: value, unitsCount: null };
}
