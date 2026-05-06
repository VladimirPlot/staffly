import { useDroppable } from "@dnd-kit/core";
import { useSortable } from "@dnd-kit/sortable";
import { CSS, useCombinedRefs } from "@dnd-kit/utilities";
import { Archive, Edit3, ExternalLink, Folder, FolderOpen, GripVertical, MoveRight, Trash2 } from "lucide-react";
import type { ReactNode } from "react";
import { Link } from "react-router-dom";

import { cn } from "../../../shared/lib/cn";
import Card from "../../../shared/ui/Card";
import Icon from "../../../shared/ui/Icon";
import { formatDateFromIso } from "../../../shared/utils/date";
import type { DishwareInventoryFolderDto, DishwareInventorySummaryDto } from "../api";
import { folderDropId, getDragOverlayWidth, objectId } from "../dishwareInventoriesDnd";
import type { DishwareObject } from "../dishwareInventoriesTypes";
import { formatInventoryLossAmount, formatInventoryLossCount, getInventoryStatusBadgeClass } from "../utils";
import DishwareInventoryObjectActionsMenu from "./DishwareInventoryObjectActionsMenu";

function InventoryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-subtle rounded-2xl border bg-[color:var(--staffly-control)]/45 px-3 py-2">
      <div className="text-muted text-[11px] font-medium">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
    </div>
  );
}

function FolderCard({
  folder,
  actionLoading,
  dragEnabled = false,
  canDropInto = false,
  isDragActive = false,
  onOpen,
  onEdit,
  onMove,
  onTrash,
}: {
  folder: DishwareInventoryFolderDto;
  actionLoading: string | null;
  dragEnabled?: boolean;
  canDropInto?: boolean;
  isDragActive?: boolean;
  onOpen: (folderId: number) => void;
  onEdit: (folder: DishwareInventoryFolderDto) => void;
  onMove: (folder: DishwareInventoryFolderDto) => void;
  onTrash: (folder: DishwareInventoryFolderDto) => void;
}) {
  const trashActionKey = `trash-folder-${folder.id}`;
  const sortableId = objectId("folder", folder.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: !dragEnabled,
  });
  const { isOver, setNodeRef: setDropNodeRef } = useDroppable({
    id: folderDropId(folder.id),
    disabled: !dragEnabled || !canDropInto,
  });
  const setCombinedNodeRef = useCombinedRefs(setNodeRef, setDropNodeRef);
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };
  const showUnavailableDrop = isDragActive && !canDropInto && !isDragging;

  return (
    <div ref={setCombinedNodeRef} style={style}>
      <Card
        className={cn(
          "group hover:bg-app relative rounded-[1.25rem] p-2.5 transition sm:p-3",
          isDragging && "opacity-0",
          isDragActive && canDropInto && !isOver && "ring-dashed ring-1 ring-[var(--staffly-border)]/70 ring-inset",
          isOver &&
            "translate-y-[-1px] scale-[1.006] bg-[color:var(--staffly-control)]/45 shadow-[0_18px_42px_rgba(15,23,42,0.13)] ring-1 ring-[var(--staffly-ring)] ring-inset",
          showUnavailableDrop && "opacity-60",
        )}
      >
        <div className="flex items-start gap-2">
          {dragEnabled ? (
            <button
              type="button"
              className="border-subtle text-muted hover:text-default hover:bg-app active:bg-app mt-1 inline-flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-2xl border bg-[color:var(--staffly-surface)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
              aria-label={`Перетащить папку ${folder.name}`}
              {...attributes}
              {...listeners}
            >
              <Icon icon={GripVertical} size="sm" decorative />
            </button>
          ) : null}
          <button
            type="button"
            className="flex min-h-14 min-w-0 flex-1 items-start gap-3 rounded-2xl px-2 py-2 text-left transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
            onClick={() => onOpen(folder.id)}
          >
            <span
              className={cn(
                "mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)] transition group-hover:bg-[color:var(--staffly-control-hover)]",
                isOver &&
                  "text-strong bg-[color:var(--staffly-control-hover)] shadow-sm ring-1 ring-[var(--staffly-ring)]/60 ring-inset",
              )}
            >
              <Icon icon={isOver ? FolderOpen : Folder} size="sm" decorative />
            </span>
            <span className="min-w-0">
              <span className="block text-base font-semibold [overflow-wrap:anywhere]">{folder.name}</span>
              {folder.description ? (
                <span className="text-muted mt-1 block text-sm [overflow-wrap:anywhere]">{folder.description}</span>
              ) : (
                <span className="text-muted mt-1 block text-sm">Папка</span>
              )}
            </span>
          </button>
          <DishwareInventoryObjectActionsMenu
            title={folder.name}
            description={folder.description || "Папка инвентаризаций"}
            actions={[
              {
                label: "Открыть",
                icon: ExternalLink,
                onSelect: () => onOpen(folder.id),
              },
              {
                label: "Изменить",
                icon: Edit3,
                onSelect: () => onEdit(folder),
              },
              {
                label: "Переместить",
                icon: MoveRight,
                onSelect: () => onMove(folder),
              },
              {
                label: actionLoading === trashActionKey ? "Перемещаем в корзину..." : "В корзину",
                icon: Trash2,
                tone: "danger",
                disabled: actionLoading === trashActionKey,
                onSelect: () => onTrash(folder),
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

function InventoryCard({
  inventory,
  actionLoading,
  dragEnabled = false,
  onOpen,
  onMove,
  onTrash,
}: {
  inventory: DishwareInventorySummaryDto;
  actionLoading: string | null;
  dragEnabled?: boolean;
  onOpen: (inventoryId: number) => void;
  onMove: (inventory: DishwareInventorySummaryDto) => void;
  onTrash: (inventory: DishwareInventorySummaryDto) => void;
}) {
  const trashActionKey = `trash-inventory-${inventory.id}`;
  const sortableId = objectId("inventory", inventory.id);
  const { attributes, listeners, setNodeRef, transform, transition, isDragging } = useSortable({
    id: sortableId,
    disabled: !dragEnabled,
  });
  const style = {
    transform: CSS.Translate.toString(transform),
    transition,
  };

  return (
    <div ref={setNodeRef} style={style}>
      <Card className={cn("group hover:bg-app rounded-[1.25rem] p-2.5 transition sm:p-3", isDragging && "opacity-0")}>
        <div className="flex items-start gap-2">
          {dragEnabled ? (
            <button
              type="button"
              className="border-subtle text-muted hover:text-default hover:bg-app active:bg-app mt-1 inline-flex h-10 w-10 shrink-0 touch-none items-center justify-center rounded-2xl border bg-[color:var(--staffly-surface)] transition focus:outline-none focus-visible:ring-2 focus-visible:ring-[var(--staffly-ring)]"
              aria-label={`Перетащить документ ${inventory.title}`}
              {...attributes}
              {...listeners}
            >
              <Icon icon={GripVertical} size="sm" decorative />
            </button>
          ) : null}
          <Link
            to={`/inventories/dishware/${inventory.id}`}
            className="min-w-0 flex-1 rounded-2xl px-2 py-2 transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-lg font-semibold [overflow-wrap:anywhere] group-hover:underline">
                    {inventory.title}
                  </span>
                  <span className={getInventoryStatusBadgeClass(inventory.status)}>
                    {inventory.status === "COMPLETED" ? "Завершена" : "Черновик"}
                  </span>
                </div>
                <div className="text-muted mt-1 text-sm">
                  Дата: {formatDateFromIso(inventory.inventoryDate)}
                  {inventory.sourceInventoryTitle ? ` • На основе: ${inventory.sourceInventoryTitle}` : ""}
                </div>
                {inventory.comment ? (
                  <div className="text-default mt-2 text-sm [overflow-wrap:anywhere]">{inventory.comment}</div>
                ) : null}
              </div>

              <div className="grid grid-cols-3 gap-2 lg:min-w-[300px]">
                <InventoryMetric label="Позиции" value={inventory.itemsCount} />
                <InventoryMetric label="Потери" value={formatInventoryLossCount(inventory.totalLossQty)} />
                <InventoryMetric label="Сумма" value={formatInventoryLossAmount(inventory.totalLossAmount)} />
              </div>
            </div>
          </Link>
          <DishwareInventoryObjectActionsMenu
            title={inventory.title}
            description={`Документ от ${formatDateFromIso(inventory.inventoryDate)}`}
            actions={[
              {
                label: "Открыть",
                icon: ExternalLink,
                onSelect: () => onOpen(inventory.id),
              },
              {
                label: "Переместить",
                icon: MoveRight,
                onSelect: () => onMove(inventory),
              },
              {
                label: actionLoading === trashActionKey ? "Перемещаем в корзину..." : "В корзину",
                icon: Trash2,
                tone: "danger",
                disabled: actionLoading === trashActionKey,
                onSelect: () => onTrash(inventory),
              },
            ]}
          />
        </div>
      </Card>
    </div>
  );
}

export function DishwareDragOverlayCard({ object, width }: { object: DishwareObject | null; width: number | null }) {
  if (!object) return null;

  const title = object.kind === "folder" ? object.folder.name : object.inventory.title;
  const subtitle =
    object.kind === "folder"
      ? object.folder.description || "Папка"
      : `${formatDateFromIso(object.inventory.inventoryDate)} · ${
          object.inventory.status === "COMPLETED" ? "Завершена" : "Черновик"
        }`;
  const IconComponent = object.kind === "folder" ? Folder : Archive;

  return (
    <div className="pointer-events-none" style={{ width: getDragOverlayWidth(width) }}>
      <Card className="bg-surface/95 rounded-2xl p-2 shadow-xl ring-1 ring-[var(--staffly-ring)] backdrop-blur">
        <div className="flex min-h-11 items-center gap-2.5">
          <span className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--staffly-control-hover)]">
            <Icon icon={IconComponent} size="sm" decorative />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block truncate text-sm font-semibold">{title}</span>
            <span className="text-muted mt-0.5 block truncate text-xs">{subtitle}</span>
          </span>
        </div>
      </Card>
    </div>
  );
}

export default function DishwareObjectList({
  objects,
  activeObjectId,
  blockedFolderIds,
  actionLoading,
  onOpenFolder,
  onOpenInventory,
  onEditFolder,
  onMoveFolder,
  onMoveInventory,
  onTrashFolder,
  onTrashInventory,
}: {
  objects: DishwareObject[];
  activeObjectId: string | null;
  blockedFolderIds: Set<number>;
  actionLoading: string | null;
  onOpenFolder: (folderId: number) => void;
  onOpenInventory: (inventoryId: number) => void;
  onEditFolder: (folder: DishwareInventoryFolderDto) => void;
  onMoveFolder: (folder: DishwareInventoryFolderDto) => void;
  onMoveInventory: (inventory: DishwareInventorySummaryDto) => void;
  onTrashFolder: (folder: DishwareInventoryFolderDto) => void;
  onTrashInventory: (inventory: DishwareInventorySummaryDto) => void;
}) {
  if (objects.length === 0) return null;

  return (
    <div className="space-y-3">
      {objects.map((object) =>
        object.kind === "folder" ? (
          <FolderCard
            key={objectId("folder", object.id)}
            folder={object.folder}
            actionLoading={actionLoading}
            dragEnabled
            canDropInto={Boolean(activeObjectId) && !blockedFolderIds.has(object.id)}
            isDragActive={Boolean(activeObjectId)}
            onOpen={onOpenFolder}
            onEdit={onEditFolder}
            onMove={onMoveFolder}
            onTrash={onTrashFolder}
          />
        ) : (
          <InventoryCard
            key={objectId("inventory", object.id)}
            inventory={object.inventory}
            actionLoading={actionLoading}
            dragEnabled
            onOpen={onOpenInventory}
            onMove={onMoveInventory}
            onTrash={onTrashInventory}
          />
        ),
      )}
    </div>
  );
}
