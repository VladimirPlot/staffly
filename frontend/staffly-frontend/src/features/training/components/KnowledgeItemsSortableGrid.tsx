import { useSortable } from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import { Edit3, GripVertical, MoveRight, Trash2 } from "lucide-react";

import Icon from "../../../shared/ui/Icon";
import type { TrainingKnowledgeItemObject } from "../trainingFolderObjects";
import { trainingObjectId } from "../trainingFolderDnd";
import KnowledgeItemCard from "./KnowledgeItemCard";
import TrainingObjectActionsMenu, { type TrainingObjectAction } from "./TrainingObjectActionsMenu";

type Props = {
  objects: TrainingKnowledgeItemObject[];
  selectedObjectId: string | null;
  actionLoading: string | null;
  canManage: boolean;
  onSelectObject: (object: TrainingKnowledgeItemObject) => void;
  onEditObject: (object: TrainingKnowledgeItemObject) => void;
  onMoveObject: (object: TrainingKnowledgeItemObject) => void;
  onArchiveObject: (object: TrainingKnowledgeItemObject) => void;
};

function SortableKnowledgeItemCard({
  object,
  selected,
  actionLoading,
  canManage,
  onSelect,
  onEdit,
  onMove,
  onArchive,
}: {
  object: TrainingKnowledgeItemObject;
  selected: boolean;
  actionLoading: string | null;
  canManage: boolean;
  onSelect: () => void;
  onEdit: () => void;
  onMove: () => void;
  onArchive: () => void;
}) {
  const sortableId = trainingObjectId(object.kind, object.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: !canManage,
  });
  const archiveActionKey = `archive-${object.kind}-${object.id}`;
  const actions: TrainingObjectAction[] = [
    { label: "Изменить", icon: Edit3, onSelect: onEdit },
    { label: "Переместить", icon: MoveRight, onSelect: onMove },
    {
      label: actionLoading === archiveActionKey ? "Перемещаем в корзину..." : "В корзину",
      icon: Trash2,
      tone: "danger",
      disabled: actionLoading === archiveActionKey,
      onSelect: onArchive,
    },
  ];

  return (
    <div
      ref={setNodeRef}
      className="h-full min-w-0"
      style={{ transform: CSS.Translate.toString(transform), transition }}
    >
      <KnowledgeItemCard
        item={object.item}
        canManage={canManage}
        selected={selected}
        dragging={isDragging}
        onSelect={onSelect}
        managementControls={
          canManage ? (
            <div
              className="flex shrink-0 flex-col gap-2"
              onClick={(event) => event.stopPropagation()}
              onDoubleClick={(event) => event.stopPropagation()}
            >
              <button
                type="button"
                aria-label={`Перетащить карточку: ${object.item.title}`}
                title="Изменить порядок"
                className="border-subtle bg-surface hover:bg-app text-default inline-flex h-11 w-11 cursor-grab touch-none items-center justify-center rounded-xl border active:cursor-grabbing"
                onPointerDown={(event) => event.stopPropagation()}
                {...attributes}
                {...listeners}
              >
                <Icon icon={GripVertical} size="sm" decorative />
              </button>
              <TrainingObjectActionsMenu
                title={object.item.title}
                description="Карточка базы знаний"
                actions={actions}
              />
            </div>
          ) : null
        }
      />
    </div>
  );
}

export default function KnowledgeItemsSortableGrid({
  objects,
  selectedObjectId,
  actionLoading,
  canManage,
  onSelectObject,
  onEditObject,
  onMoveObject,
  onArchiveObject,
}: Props) {
  return (
    <div
      className="grid min-w-0 grid-cols-1 items-stretch gap-4 sm:grid-cols-2 lg:grid-cols-3"
      role="listbox"
      aria-label="Карточки базы знаний"
    >
      {objects.map((object) => {
        const objectId = trainingObjectId(object.kind, object.id);
        return (
          <SortableKnowledgeItemCard
            key={objectId}
            object={object}
            selected={selectedObjectId === objectId}
            actionLoading={actionLoading}
            canManage={canManage}
            onSelect={() => onSelectObject(object)}
            onEdit={() => onEditObject(object)}
            onMove={() => onMoveObject(object)}
            onArchive={() => onArchiveObject(object)}
          />
        );
      })}
    </div>
  );
}
