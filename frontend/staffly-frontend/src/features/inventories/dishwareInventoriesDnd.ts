import { closestCenter, pointerWithin, type CollisionDetection } from "@dnd-kit/core";

import type { DishwareObject } from "./dishwareInventoriesTypes";

export function objectId(kind: DishwareObject["kind"], id: number) {
  return `${kind}:${id}`;
}

export function parseObjectId(value: string) {
  const [kind, rawId] = value.split(":");
  const id = Number(rawId);
  if ((kind !== "folder" && kind !== "inventory") || !Number.isFinite(id)) {
    return null;
  }
  return { kind, id } as { kind: DishwareObject["kind"]; id: number };
}

export function folderDropId(folderId: number | null) {
  return folderId == null ? "folder-drop:root" : `folder-drop:${folderId}`;
}

export function parseFolderDropId(value: string) {
  if (!value.startsWith("folder-drop:")) return null;
  const rawId = value.slice("folder-drop:".length);
  if (rawId === "root") return null;
  const id = Number(rawId);
  return Number.isFinite(id) ? id : undefined;
}

export function sortDishwareObjects(a: DishwareObject, b: DishwareObject) {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

export function getDragOverlayWidth(width: number | null) {
  if (width == null) return 240;
  return Math.min(Math.max(Math.round(width * 0.28), 180), 320);
}

function isDishwareObjectId(value: string) {
  return parseObjectId(value) !== null;
}

export const dishwareCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const folderDropCollision = pointerCollisions.find((collision) => String(collision.id).startsWith("folder-drop:"));

  if (folderDropCollision) return [folderDropCollision];

  const sortablePointerCollisions = pointerCollisions.filter((collision) => isDishwareObjectId(String(collision.id)));
  if (sortablePointerCollisions.length > 0) return sortablePointerCollisions;

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => isDishwareObjectId(String(container.id))),
  });
};
