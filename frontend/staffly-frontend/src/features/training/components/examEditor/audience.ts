import type { PositionDto } from "../../../dictionaries/api";
import type { TrainingExamMode } from "../../api/types";

export function allExamAudienceIds(positions: PositionDto[], manageable: Set<number>, currentIds: number[]) {
  return Array.from(
    new Set([
      ...currentIds.filter(
        (id) => !manageable.has(id) || positions.some((position) => position.id === id && !position.active),
      ),
      ...positions.filter((position) => position.active && manageable.has(position.id)).map((position) => position.id),
    ]),
  );
}

export function toggleExamAudience(
  mode: TrainingExamMode,
  allSelected: boolean,
  ids: number[],
  positionId: number,
  positions: PositionDto[],
  manageable: Set<number>,
) {
  const position = positions.find((candidate) => candidate.id === positionId);
  if (!manageable.has(positionId) || !position || (!position.active && !ids.includes(positionId))) {
    return { ids, allSelected };
  }
  const next =
    allSelected && position.active
      ? [
          ...ids.filter(
            (id) => !manageable.has(id) || positions.some((candidate) => candidate.id === id && !candidate.active),
          ),
          positionId,
        ]
      : ids.includes(positionId)
        ? ids.filter((id) => id !== positionId)
        : [...ids, positionId];
  if (next.length === 0) {
    return { ids: mode === "CERTIFICATION" ? allExamAudienceIds(positions, manageable, []) : [], allSelected: true };
  }
  return { ids: Array.from(new Set(next)), allSelected: false };
}
