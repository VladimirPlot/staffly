import { useDroppable } from "@dnd-kit/core";
import { SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS, useCombinedRefs } from "@dnd-kit/utilities";
import { GripVertical } from "lucide-react";
import type { ReactNode } from "react";

import { cn } from "../../../shared/lib/cn";
import IconButton from "../../../shared/ui/IconButton";
import { trainingFolderDropId, trainingObjectId, type TrainingDndObjectKind } from "../trainingFolderDnd";

export function TrainingSortableBlock({
  enabled,
  items,
  children,
}: {
  enabled: boolean;
  items: string[];
  children: ReactNode;
}) {
  if (!enabled) return <>{children}</>;
  return (
    <SortableContext items={items} strategy={verticalListSortingStrategy}>
      {children}
    </SortableContext>
  );
}

/** Pure sortable source: drag handle plus an optional folder move surface. */
export function TrainingSortableSource({
  kind,
  id,
  droppableFolder = false,
  children,
}: {
  kind: TrainingDndObjectKind;
  id: number;
  draggable?: boolean;
  droppableFolder?: boolean;
  children: ReactNode;
}) {
  const drag = useSortable({ id: trainingObjectId(kind, id) });
  const drop = useDroppable({
    id: kind === "folder" ? trainingFolderDropId(id) : `training-disabled-drop:${kind}:${id}`,
    disabled: kind !== "folder" || !droppableFolder,
  });
  const nodeRef = useCombinedRefs(drag.setNodeRef, drop.setNodeRef);
  return (
    <div
      ref={nodeRef}
      style={{ transform: CSS.Translate.toString(drag.transform), transition: drag.transition }}
      className={cn(drag.isDragging && "opacity-40", drop.isOver && "rounded-2xl ring-2 ring-[var(--staffly-ring)]")}
    >
      <div className="flex items-stretch gap-2">
        <div className="flex shrink-0 items-center">
          <IconButton
            {...drag.attributes}
            {...drag.listeners}
            aria-label="Изменить порядок"
            title="Изменить порядок"
            className="cursor-grab touch-none active:cursor-grabbing"
          >
            <GripVertical className="h-4 w-4" />
          </IconButton>
        </div>
        <div className="min-w-0 flex-1">{children}</div>
      </div>
    </div>
  );
}
