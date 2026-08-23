import {
  DndContext,
  MeasuringStrategy,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import type { ReactNode } from "react";

/** Technical Training DnD surface. Intent and domain actions belong to callers. */
export function TrainingDndContext({
  enabled,
  collisionDetection,
  onDragStart,
  onDragCancel,
  onDragEnd,
  children,
}: {
  enabled: boolean;
  collisionDetection: CollisionDetection;
  onDragStart?: (event: DragStartEvent) => void;
  onDragCancel?: () => void;
  onDragEnd: (event: DragEndEvent) => void;
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;

  return (
    <DndContext
      collisionDetection={collisionDetection}
      measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
      onDragStart={onDragStart}
      onDragCancel={onDragCancel}
      onDragEnd={onDragEnd}
    >
      {children}
    </DndContext>
  );
}
