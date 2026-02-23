export function bySortOrderAndName<T extends { sortOrder?: number; name?: string; title?: string; id: number }>(
  a: T,
  b: T
): number {
  const leftOrder = a.sortOrder ?? 0;
  const rightOrder = b.sortOrder ?? 0;

  if (leftOrder !== rightOrder) {
    return leftOrder - rightOrder;
  }

  const leftName = (a.name ?? a.title ?? "").toLocaleLowerCase("ru");
  const rightName = (b.name ?? b.title ?? "").toLocaleLowerCase("ru");
  if (leftName !== rightName) {
    return leftName.localeCompare(rightName, "ru");
  }

  return a.id - b.id;
}
