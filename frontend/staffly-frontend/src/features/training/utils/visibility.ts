export function buildVisibilityLabel(
  visibilityPositionIds: number[],
  positionNameById: Map<number, string>
): string {
  if (visibilityPositionIds.length === 0) {
    return "ВСЕМ";
  }

  return visibilityPositionIds.map((id) => positionNameById.get(id) ?? `#${id}`).join(", ").toUpperCase();
}
