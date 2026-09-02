import { pointerWithin, type CollisionDetection, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import type { ReactNode } from "react";

import {
  parseTrainingFolderDropId,
  parseTrainingObjectId,
  trainingCollisionDetection,
  trainingObjectId,
  type TrainingDndObject,
} from "../../trainingFolderDnd";
import { TrainingDndContext } from "../TrainingDndContext";

const certificationCollisionDetection: CollisionDetection = (args) => {
  const collisions = pointerWithin(args);
  const folderDrop = collisions.find((collision) => parseTrainingFolderDropId(String(collision.id)) !== undefined);
  if (!folderDrop) return trainingCollisionDetection(args);

  const source = parseTrainingObjectId(String(args.active.id));
  const targetFolderId = parseTrainingFolderDropId(String(folderDrop.id));
  const sortableFolder = collisions.find(
    (collision) => String(collision.id) === trainingObjectId("folder", Number(targetFolderId)),
  );
  const rect = folderDrop.data?.droppableContainer?.rect.current;
  if (
    source?.kind === "folder" &&
    sortableFolder &&
    rect &&
    args.pointerCoordinates &&
    (args.pointerCoordinates.y < rect.top + rect.height * 0.25 ||
      args.pointerCoordinates.y > rect.bottom - rect.height * 0.25)
  ) {
    return [sortableFolder];
  }
  return [folderDrop];
};

/** Certification domain router: explicit containers move; same-kind siblings reorder. */
export function CertificationManagementDnd({
  enabled,
  canMove,
  onMove,
  onReorder,
  onActiveIdChange,
  children,
}: {
  enabled: boolean;
  canMove: (source: TrainingDndObject) => boolean;
  onMove: (source: TrainingDndObject, folderId: number | null) => Promise<void>;
  onReorder: (source: TrainingDndObject, target: TrainingDndObject) => Promise<void>;
  onActiveIdChange?: (id: string | null) => void;
  children: ReactNode;
}) {
  const finishDrag = () => onActiveIdChange?.(null);
  const handleDragStart = (event: DragStartEvent) => onActiveIdChange?.(String(event.active.id));
  const handleDragEnd = async (event: DragEndEvent) => {
    finishDrag();
    if (!event.over) return;
    const source = parseTrainingObjectId(String(event.active.id));
    if (!source) return;
    const targetFolderId = parseTrainingFolderDropId(String(event.over.id));
    if (targetFolderId !== undefined) {
      if (!canMove(source) || (source.kind === "folder" && source.id === targetFolderId)) return;
      await onMove(source, targetFolderId);
      return;
    }
    const target = parseTrainingObjectId(String(event.over.id));
    if (target?.kind === source.kind && target.id !== source.id) await onReorder(source, target);
  };

  return (
    <TrainingDndContext
      enabled={enabled}
      collisionDetection={certificationCollisionDetection}
      onDragStart={handleDragStart}
      onDragCancel={finishDrag}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      {children}
    </TrainingDndContext>
  );
}
