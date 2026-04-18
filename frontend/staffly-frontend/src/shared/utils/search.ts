export function normalizeSearchText(value: string | null | undefined): string {
  return (value || "")
    .toLowerCase()
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizePhoneSearchText(value: string | null | undefined): string {
  return (value || "").replace(/\D/g, "");
}

export function matchesSearchText(values: Array<string | null | undefined>, query: string): boolean {
  const normalizedQuery = normalizeSearchText(query);
  if (!normalizedQuery) return false;

  return values.some((value) => normalizeSearchText(value).includes(normalizedQuery));
}

export function matchesPhoneSearch(value: string | null | undefined, query: string): boolean {
  const normalizedQuery = normalizePhoneSearchText(query);
  if (!normalizedQuery) return false;

  return normalizePhoneSearchText(value).includes(normalizedQuery);
}
