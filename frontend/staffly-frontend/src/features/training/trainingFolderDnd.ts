import { closestCenter, pointerWithin, type CollisionDetection, type Modifier } from "@dnd-kit/core";
import { getEventCoordinates } from "@dnd-kit/utilities";

import type { TrainingFolderDto } from "./api/types";
import type { TrainingFolderListObject } from "./trainingFolderObjects";

export function trainingObjectId(kind: TrainingFolderListObject["kind"], id: number): string {
  return `${kind}:${id}`;
}

export function parseTrainingObjectId(value: string):
  | { kind: TrainingFolderListObject["kind"]; id: number }
  | null {
  const [kind, rawId] = value.split(":");
  const id = Number(rawId);
  if (!["folder", "knowledgeItem", "question", "practiceExam"].includes(kind) || !Number.isFinite(id)) {
    return null;
  }
  return { kind: kind as TrainingFolderListObject["kind"], id };
}

export function trainingFolderDropId(folderId: number | null): string {
  return folderId == null ? "training-folder-drop:root" : `training-folder-drop:${folderId}`;
}

export function parseTrainingFolderDropId(value: string): number | null | undefined {
  if (!value.startsWith("training-folder-drop:")) return undefined;
  const rawId = value.slice("training-folder-drop:".length);
  if (rawId === "root") return null;
  const id = Number(rawId);
  return Number.isFinite(id) ? id : undefined;
}

export function sortTrainingObjects(a: TrainingFolderListObject, b: TrainingFolderListObject): number {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

export function buildTrainingFolderChain(
  folder: TrainingFolderDto | null,
  folderMap: Map<number, TrainingFolderDto>,
): TrainingFolderDto[] {
  const chain: TrainingFolderDto[] = [];
  const seen = new Set<number>();
  let cursor = folder;
  while (cursor && !seen.has(cursor.id)) {
    chain.unshift(cursor);
    seen.add(cursor.id);
    cursor = cursor.parentId == null ? null : (folderMap.get(cursor.parentId) ?? null);
  }
  return chain;
}

export function getTrainingFolderPathLabel(
  folder: TrainingFolderDto,
  folderMap: Map<number, TrainingFolderDto>,
): string {
  return buildTrainingFolderChain(folder, folderMap)
    .map((item) => item.name)
    .join(" / ");
}

export function trainingDescendantIds(rootId: number, folders: TrainingFolderDto[]): Set<number> {
  const children = new Map<number, number[]>();
  folders.forEach((folder) => {
    if (folder.parentId == null) return;
    children.set(folder.parentId, [...(children.get(folder.parentId) ?? []), folder.id]);
  });

  const result = new Set<number>();
  const queue = [rootId];
  while (queue.length > 0) {
    const id = queue.shift()!;
    result.add(id);
    queue.push(...(children.get(id) ?? []));
  }
  return result;
}

function isTrainingObjectId(value: string): boolean {
  return parseTrainingObjectId(value) !== null;
}

export const trainingCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const folderDropCollision = pointerCollisions.find((collision) =>
    String(collision.id).startsWith("training-folder-drop:"),
  );

  if (folderDropCollision) return [folderDropCollision];

  const sortablePointerCollisions = pointerCollisions.filter((collision) => isTrainingObjectId(String(collision.id)));
  if (sortablePointerCollisions.length > 0) return sortablePointerCollisions;

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => isTrainingObjectId(String(container.id))),
  });
};

export const centerTrainingDragOverlayOnCursor: Modifier = ({
  activatorEvent,
  activeNodeRect,
  overlayNodeRect,
  transform,
}) => {
  if (!activatorEvent || !activeNodeRect || !overlayNodeRect) return transform;

  const activatorCoordinates = getEventCoordinates(activatorEvent);
  if (!activatorCoordinates) return transform;

  return {
    ...transform,
    x: transform.x + activatorCoordinates.x - activeNodeRect.left - overlayNodeRect.width / 2,
    y: transform.y + activatorCoordinates.y - activeNodeRect.top - overlayNodeRect.height / 2,
  };
};

export function getTrainingDragOverlayWidth(width: number | null): number {
  if (width == null) return 240;
  return Math.min(Math.max(Math.round(width * 0.28), 180), 320);
}
