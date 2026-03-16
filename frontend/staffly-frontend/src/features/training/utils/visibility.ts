export function buildVisibilityLabel(
  visibilityPositionIds: number[],
  positionNameById: Map<number, string>,
  maxVisibleNames: number = 2
): string {
  if (visibilityPositionIds.length === 0) {
    return "Всем";
  }

  const names = visibilityPositionIds.map((id) => positionNameById.get(id) ?? `#${id}`);

  if (names.length <= maxVisibleNames) {
    return names.join(", ");
  }

  const visibleNames = names.slice(0, maxVisibleNames).join(", ");
  return `${visibleNames} +${names.length - maxVisibleNames}`;
}
