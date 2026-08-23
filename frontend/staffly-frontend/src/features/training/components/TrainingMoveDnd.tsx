import { useDraggable, useDroppable, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { CSS, useCombinedRefs } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../shared/lib/cn";
import IconButton from "../../../shared/ui/IconButton";
import {
  parseTrainingFolderDropId,
  parseTrainingObjectId,
  trainingCollisionDetection,
  trainingFolderDropId,
  trainingObjectId,
  type TrainingDndObject,
  type TrainingDndObjectKind,
} from "../trainingFolderDnd";
import { TrainingDndContext } from "./TrainingDndContext";

/** Shared move-only DnD mechanics. Domain code owns source policy and API actions. */
export function TrainingMoveDndContext({
  enabled,
  canMove,
  onMove,
  onActiveIdChange,
  children,
}: {
  enabled: boolean;
  canMove: (source: TrainingDndObject) => boolean;
  onMove: (source: TrainingDndObject, folderId: number | null) => Promise<void>;
  onActiveIdChange?: (id: string | null) => void;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  const handleDragStart = (event: DragStartEvent) => onActiveIdChange?.(String(event.active.id));
  const finishDrag = () => onActiveIdChange?.(null);
  const handleDragEnd = async (event: DragEndEvent) => {
    finishDrag();
    const source = parseTrainingObjectId(String(event.active.id));
    const targetFolderId = event.over ? parseTrainingFolderDropId(String(event.over.id)) : undefined;
    if (!source || !canMove(source) || targetFolderId === undefined) return;
    if (source.kind === "folder" && source.id === targetFolderId) return;
    await onMove(source, targetFolderId);
  };

  return (
    <TrainingDndContext
      enabled
      collisionDetection={trainingCollisionDetection}
      onDragStart={handleDragStart}
      onDragCancel={finishDrag}
      onDragEnd={(event) => void handleDragEnd(event)}
    >
      {children}
    </TrainingDndContext>
  );
}

/** A handle-only draggable source which may also expose a folder drop target. */
export function TrainingDraggableSource({
  kind,
  id,
  draggable,
  droppableFolder = false,
  children,
}: {
  kind: TrainingDndObjectKind;
  id: number;
  draggable: boolean;
  droppableFolder?: boolean;
  children: ReactNode;
}) {
  if (!draggable && !droppableFolder) return <>{children}</>;

  return (
    <ActiveTrainingDraggableSource kind={kind} id={id} draggable={draggable} droppableFolder={droppableFolder}>
      {children}
    </ActiveTrainingDraggableSource>
  );
}

function ActiveTrainingDraggableSource({
  kind,
  id,
  draggable,
  droppableFolder,
  children,
}: {
  kind: TrainingDndObjectKind;
  id: number;
  draggable: boolean;
  droppableFolder: boolean;
  children: ReactNode;
}) {
  const drag = useDraggable({ id: trainingObjectId(kind, id), disabled: !draggable });
  const drop = useDroppable({
    id: kind === "folder" ? trainingFolderDropId(id) : `training-disabled-drop:${kind}:${id}`,
    disabled: kind !== "folder" || !droppableFolder,
  });
  const nodeRef = useCombinedRefs(drag.setNodeRef, drop.setNodeRef);

  return (
    <div
      ref={nodeRef}
      style={{ transform: CSS.Translate.toString(drag.transform) }}
      className={cn(drag.isDragging && "opacity-40", drop.isOver && "rounded-2xl ring-2 ring-[var(--staffly-ring)]")}
    >
      <div className="flex items-stretch gap-2">
        {draggable && (
          <div className="flex shrink-0 items-center">
            <IconButton
              {...drag.attributes}
              {...drag.listeners}
              aria-label="Перетащить"
              title="Перетащить"
              className="cursor-grab touch-none active:cursor-grabbing"
            >
              <GripVertical className="h-4 w-4" />
            </IconButton>
          </div>
        )}
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
