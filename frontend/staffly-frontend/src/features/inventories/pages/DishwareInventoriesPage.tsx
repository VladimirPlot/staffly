import {
  closestCenter,
  DndContext,
  DragOverlay,
  MeasuringStrategy,
  pointerWithin,
  useDroppable,
  type CollisionDetection,
  type DragEndEvent,
  type DragStartEvent,
} from "@dnd-kit/core";
import { arrayMove, SortableContext, useSortable, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { CSS, useCombinedRefs } from "@dnd-kit/utilities";
import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Folder,
  FolderPlus,
  GripVertical,
  MoreVertical,
  MoveRight,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import { cn } from "../../../shared/lib/cn";
import { useSortableDnd } from "../../../shared/hooks/useSortableDnd";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownMenu from "../../../shared/ui/DropdownMenu";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";
import IconButton from "../../../shared/ui/IconButton";
import Input from "../../../shared/ui/Input";
import Modal from "../../../shared/ui/Modal";
import Textarea from "../../../shared/ui/Textarea";
import { formatDateFromIso } from "../../../shared/utils/date";
import {
  createDishwareInventory,
  createDishwareInventoryFolder,
  deleteDishwareInventory,
  deleteDishwareInventoryFolder,
  listDishwareInventories,
  listDishwareInventoryFolders,
  listDishwareInventoryTrash,
  moveDishwareInventory,
  moveDishwareInventoryFolder,
  reorderDishwareInventoryObjects,
  restoreDishwareInventory,
  restoreDishwareInventoryFolder,
  trashDishwareInventory,
  trashDishwareInventoryFolder,
  updateDishwareInventoryFolder,
  type CreateDishwareInventoryRequest,
  type DishwareInventoryFolderDto,
  type DishwareInventorySummaryDto,
} from "../api";
import CreateDishwareInventoryModal from "../components/CreateDishwareInventoryModal";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import { formatInventoryLossAmount, formatInventoryLossCount, getInventoryStatusBadgeClass } from "../utils";

type FolderModalState =
  | { mode: "create"; parentId: number | null; folder?: null }
  | { mode: "edit"; parentId: number | null; folder: DishwareInventoryFolderDto };

type MoveTarget = { kind: "folder"; id: number; title: string } | { kind: "inventory"; id: number; title: string };

type DishwareObject =
  | { kind: "folder"; id: number; sortOrder: number; folder: DishwareInventoryFolderDto }
  | { kind: "inventory"; id: number; sortOrder: number; inventory: DishwareInventorySummaryDto };

type PermanentDeleteTarget =
  | { kind: "folder"; id: number; title: string }
  | { kind: "inventory"; id: number; title: string }
  | { kind: "all"; title: string };

type InventoryAction = {
  label: string;
  icon: typeof Folder;
  onSelect: () => void;
  tone?: "default" | "danger";
  disabled?: boolean;
};

function formatDate(value: string): string {
  return formatDateFromIso(value);
}

function objectId(kind: DishwareObject["kind"], id: number) {
  return `${kind}:${id}`;
}

function parseObjectId(value: string) {
  const [kind, rawId] = value.split(":");
  const id = Number(rawId);
  if ((kind !== "folder" && kind !== "inventory") || !Number.isFinite(id)) {
    return null;
  }
  return { kind, id } as { kind: DishwareObject["kind"]; id: number };
}

function folderDropId(folderId: number | null) {
  return folderId == null ? "folder-drop:root" : `folder-drop:${folderId}`;
}

function parseFolderDropId(value: string) {
  if (!value.startsWith("folder-drop:")) return null;
  const rawId = value.slice("folder-drop:".length);
  if (rawId === "root") return null;
  const id = Number(rawId);
  return Number.isFinite(id) ? id : undefined;
}

function sortDishwareObjects(a: DishwareObject, b: DishwareObject) {
  return a.sortOrder - b.sortOrder || a.id - b.id;
}

function getDragOverlayWidth(width: number | null) {
  if (width == null) return 240;
  return Math.min(Math.max(Math.round(width * 0.28), 180), 320);
}

function isDishwareObjectId(value: string) {
  return parseObjectId(value) !== null;
}

const dishwareCollisionDetection: CollisionDetection = (args) => {
  const pointerCollisions = pointerWithin(args);
  const folderDropCollision = pointerCollisions.find((collision) =>
    String(collision.id).startsWith("folder-drop:"),
  );

  if (folderDropCollision) return [folderDropCollision];

  const sortablePointerCollisions = pointerCollisions.filter((collision) => isDishwareObjectId(String(collision.id)));
  if (sortablePointerCollisions.length > 0) return sortablePointerCollisions;

  return closestCenter({
    ...args,
    droppableContainers: args.droppableContainers.filter((container) => isDishwareObjectId(String(container.id))),
  });
};

function ActionMenuItem({
  action,
  close,
  isMobile,
}: {
  action: InventoryAction;
  close: () => void;
  isMobile: boolean;
}) {
  return (
    <button
      type="button"
      role="menuitem"
      disabled={action.disabled}
      className={[
        "flex w-full items-center gap-3 rounded-2xl text-left text-sm transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)]",
        isMobile ? "active:bg-app/80 min-h-12 px-4 py-3" : "hover:bg-app px-3 py-2.5",
        action.tone === "danger" ? "text-red-600" : "text-default",
        action.disabled ? "cursor-not-allowed opacity-50" : "",
      ].join(" ")}
      onClick={() => {
        if (action.disabled) return;
        close();
        action.onSelect();
      }}
    >
      <Icon icon={action.icon} size="sm" decorative className="shrink-0" />
      <span className="min-w-0 flex-1 truncate">{action.label}</span>
    </button>
  );
}

function InventoryObjectActionsMenu({
  title,
  description,
  actions,
}: {
  title: string;
  description: ReactNode;
  actions: InventoryAction[];
}) {
  return (
    <DropdownMenu
      menuClassName="w-64"
      mobileSheetTitle={title}
      mobileSheetSubtitle={description}
      trigger={(triggerProps) => (
        <IconButton
          aria-label={`Действия: ${title}`}
          title="Действия"
          variant="unstyled"
          className="border-subtle bg-surface/95 text-default hover:bg-app active:bg-app h-11 w-11 border px-0 py-0 shadow-sm backdrop-blur-sm transition active:scale-[0.98]"
          {...triggerProps}
        >
          <Icon icon={MoreVertical} size="sm" decorative />
        </IconButton>
      )}
    >
      {({ close, isMobile }) => (
        <div className={isMobile ? "space-y-1 pb-1" : "space-y-1 p-1"}>
          {actions.map((action) => (
            <ActionMenuItem key={action.label} action={action} close={close} isMobile={isMobile} />
          ))}
        </div>
      )}
    </DropdownMenu>
  );
}

function sortFolders(a: DishwareInventoryFolderDto, b: DishwareInventoryFolderDto) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ru");
}

function buildFolderChain(
  folder: DishwareInventoryFolderDto | null,
  folderMap: Map<number, DishwareInventoryFolderDto>,
) {
  const chain: DishwareInventoryFolderDto[] = [];
  const seen = new Set<number>();
  let cursor = folder;
  while (cursor && !seen.has(cursor.id)) {
    chain.unshift(cursor);
    seen.add(cursor.id);
    cursor = cursor.parentId == null ? null : (folderMap.get(cursor.parentId) ?? null);
  }
  return chain;
}

function getFolderPathLabel(folder: DishwareInventoryFolderDto, folderMap: Map<number, DishwareInventoryFolderDto>) {
  return buildFolderChain(folder, folderMap)
    .map((item) => item.name)
    .join(" / ");
}

function descendantIds(rootId: number, folders: DishwareInventoryFolderDto[]) {
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

function rootTrashedFolders(folders: DishwareInventoryFolderDto[]) {
  const trashedIds = new Set(folders.filter((folder) => folder.trashedAt).map((folder) => folder.id));
  const folderMap = new Map(folders.map((folder) => [folder.id, folder]));
  return folders.filter((folder) => {
    if (!folder.trashedAt) return false;
    let parent = folder.parentId == null ? null : (folderMap.get(folder.parentId) ?? null);
    const seen = new Set<number>();
    while (parent && !seen.has(parent.id)) {
      if (trashedIds.has(parent.id)) return false;
      seen.add(parent.id);
      parent = parent.parentId == null ? null : (folderMap.get(parent.parentId) ?? null);
    }
    return true;
  });
}

function FolderEditorModal({
  state,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  state: FolderModalState | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (payload: { name: string; description: string | null }) => void;
}) {
  const [name, setName] = useState("");
  const [description, setDescription] = useState("");

  useEffect(() => {
    if (!state) return;
    setName(state.mode === "edit" ? state.folder.name : "");
    setDescription(state.mode === "edit" ? (state.folder.description ?? "") : "");
  }, [state]);

  return (
    <Modal
      open={Boolean(state)}
      title={state?.mode === "edit" ? "Редактировать папку" : "Новая папка"}
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button
            disabled={!name.trim()}
            isLoading={submitting}
            onClick={() => onSubmit({ name: name.trim(), description: description.trim() || null })}
          >
            {state?.mode === "edit" ? "Сохранить" : "Создать"}
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <Input label="Название" value={name} maxLength={150} onChange={(event) => setName(event.target.value)} />
        <Textarea
          label="Описание"
          value={description}
          maxLength={5000}
          rows={3}
          onChange={(event) => setDescription(event.target.value)}
        />
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </Modal>
  );
}

function MoveModal({
  target,
  folders,
  currentFolderId,
  submitting,
  error,
  onClose,
  onSubmit,
}: {
  target: MoveTarget | null;
  folders: DishwareInventoryFolderDto[];
  currentFolderId: number | null;
  submitting: boolean;
  error: string | null;
  onClose: () => void;
  onSubmit: (folderId: number | null) => void;
}) {
  const [folderId, setFolderId] = useState("");

  useEffect(() => {
    if (!target) return;
    setFolderId(currentFolderId == null ? "" : String(currentFolderId));
  }, [currentFolderId, target]);

  const blocked = useMemo(
    () => (target?.kind === "folder" ? descendantIds(target.id, folders) : new Set<number>()),
    [folders, target],
  );
  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const options = folders.filter((folder) => !blocked.has(folder.id));

  return (
    <Modal
      open={Boolean(target)}
      title="Переместить"
      description={target?.title}
      onClose={onClose}
      className="max-w-lg"
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>
            Отмена
          </Button>
          <Button isLoading={submitting} onClick={() => onSubmit(folderId ? Number(folderId) : null)}>
            Переместить
          </Button>
        </>
      }
    >
      <div className="space-y-3">
        <DropdownSelect label="Куда" value={folderId} onChange={(event) => setFolderId(event.target.value)}>
          <option value="">Корень</option>
          {options.map((folder) => (
            <option key={folder.id} value={folder.id}>
              {getFolderPathLabel(folder, folderMap)}
            </option>
          ))}
        </DropdownSelect>
        {error ? <div className="text-sm text-red-600">{error}</div> : null}
      </div>
    </Modal>
  );
}

function TrashModal({
  open,
  folders,
  inventories,
  loading,
  actionLoading,
  onClose,
  onRestoreFolder,
  onRestoreInventory,
  onDeleteFolder,
  onDeleteInventory,
  onDeleteAll,
}: {
  open: boolean;
  folders: DishwareInventoryFolderDto[];
  inventories: DishwareInventorySummaryDto[];
  loading: boolean;
  actionLoading: string | null;
  onClose: () => void;
  onRestoreFolder: (folder: DishwareInventoryFolderDto) => void;
  onRestoreInventory: (inventory: DishwareInventorySummaryDto) => void;
  onDeleteFolder: (folder: DishwareInventoryFolderDto) => void;
  onDeleteInventory: (inventory: DishwareInventorySummaryDto) => void;
  onDeleteAll: () => void;
}) {
  const trashedFolders = folders.filter((folder) => folder.trashedAt).sort(sortFolders);
  const hasItems = trashedFolders.length > 0 || inventories.length > 0;

  return (
    <Modal open={open} title="Корзина" onClose={onClose} className="max-w-3xl">
      <div className="space-y-3">
        {hasItems ? (
          <div className="border-subtle flex items-center justify-between gap-3 border-b pb-3">
            <div className="text-muted text-sm">{trashedFolders.length + inventories.length} элементов в корзине</div>
            <Button
              size="sm"
              variant="outline"
              className="text-red-600"
              leftIcon={<Icon icon={Trash2} size="sm" decorative />}
              onClick={onDeleteAll}
            >
              Удалить все
            </Button>
          </div>
        ) : null}
        {loading ? <div className="text-muted text-sm">Загружаем корзину...</div> : null}
        {!loading && trashedFolders.length === 0 && inventories.length === 0 ? (
          <div className="text-muted text-sm">Корзина пуста.</div>
        ) : null}

        {trashedFolders.map((folder) => (
          <div key={`folder-${folder.id}`} className="border-subtle bg-app rounded-2xl border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <Icon icon={Folder} size="sm" decorative />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{folder.name}</span>
                </div>
                {folder.description ? <div className="text-muted mt-1 text-sm">{folder.description}</div> : null}
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  title="Восстановить"
                  aria-label={`Восстановить папку ${folder.name}`}
                  isLoading={actionLoading === `restore-folder-${folder.id}`}
                  leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
                  onClick={() => onRestoreFolder(folder)}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 text-red-600"
                  title="Удалить навсегда"
                  aria-label={`Удалить папку ${folder.name} навсегда`}
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  onClick={() => onDeleteFolder(folder)}
                />
              </div>
            </div>
          </div>
        ))}

        {inventories.map((inventory) => (
          <div key={`inventory-${inventory.id}`} className="border-subtle bg-app rounded-2xl border p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium [overflow-wrap:anywhere]">{inventory.title}</div>
                <div className="text-muted mt-1 text-sm">Дата: {formatDate(inventory.inventoryDate)}</div>
              </div>
              <div className="flex shrink-0 gap-1">
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9"
                  title="Восстановить"
                  aria-label={`Восстановить документ ${inventory.title}`}
                  isLoading={actionLoading === `restore-inventory-${inventory.id}`}
                  leftIcon={<Icon icon={RotateCcw} size="sm" decorative />}
                  onClick={() => onRestoreInventory(inventory)}
                />
                <Button
                  size="icon"
                  variant="outline"
                  className="h-9 w-9 text-red-600"
                  title="Удалить навсегда"
                  aria-label={`Удалить документ ${inventory.title} навсегда`}
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  onClick={() => onDeleteInventory(inventory)}
                />
              </div>
            </div>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function DishwareBreadcrumbs({
  currentFolderId,
  folderChain,
  activeObjectId,
  blockedFolderIds,
  onBackToInventories,
  onOpenRoot,
  onOpenFolder,
}: {
  currentFolderId: number | null;
  folderChain: DishwareInventoryFolderDto[];
  activeObjectId: string | null;
  blockedFolderIds: Set<number>;
  onBackToInventories: () => void;
  onOpenRoot: () => void;
  onOpenFolder: (folderId: number) => void;
}) {
  const isDragActive = Boolean(activeObjectId);
  const rootDropDisabled = !isDragActive || currentFolderId == null;
  const rootDrop = useDroppable({ id: folderDropId(null), disabled: rootDropDisabled });

  return (
    <nav
      aria-label="Путь к папке"
      className={cn(
        "text-muted -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 text-sm transition [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden",
        isDragActive ? "py-2" : "py-1",
      )}
    >
      <Link
        to="/app"
        className="text-default inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset"
      >
        <Icon icon={ArrowLeft} size="xs" decorative className="text-icon" />
        Главная
      </Link>
      <Icon icon={ChevronRight} size="xs" decorative className="text-icon shrink-0 opacity-55" />
      <button
        type="button"
        className="text-default h-8 shrink-0 rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset"
        onClick={onBackToInventories}
      >
        Инвентаризации
      </button>
      <Icon icon={ChevronRight} size="xs" decorative className="text-icon shrink-0 opacity-55" />
      <button
        ref={rootDrop.setNodeRef}
        type="button"
        className={cn(
          "inline-flex shrink-0 items-center border border-transparent font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset",
          isDragActive ? "min-h-11 rounded-full border-dashed px-4" : "h-8 rounded-lg px-1.5",
          currentFolderId == null ? "text-strong" : "text-default",
          isDragActive && !rootDropDisabled && "border-[var(--staffly-border)] bg-[color:var(--staffly-control)]/35",
          isDragActive && rootDropDisabled && "opacity-60",
          !isDragActive && "hover:bg-[var(--staffly-control-hover)]",
          rootDrop.isOver &&
            "border-[var(--staffly-ring)] bg-[var(--staffly-control-hover)] text-strong ring-2 ring-[var(--staffly-ring)] ring-inset",
        )}
        onClick={onOpenRoot}
      >
        Посуда
      </button>
      {folderChain.map((folder, index) => (
        <DishwareBreadcrumbFolder
          key={folder.id}
          folder={folder}
          isCurrent={index === folderChain.length - 1}
          isDragActive={isDragActive}
          disabledDrop={!isDragActive || blockedFolderIds.has(folder.id) || folder.id === currentFolderId}
          isDropCurrentFolder={isDragActive && folder.id === currentFolderId}
          onOpenFolder={onOpenFolder}
        />
      ))}
    </nav>
  );
}

function DishwareBreadcrumbFolder({
  folder,
  isCurrent,
  isDragActive,
  disabledDrop,
  isDropCurrentFolder,
  onOpenFolder,
}: {
  folder: DishwareInventoryFolderDto;
  isCurrent: boolean;
  isDragActive: boolean;
  disabledDrop: boolean;
  isDropCurrentFolder: boolean;
  onOpenFolder: (folderId: number) => void;
}) {
  const drop = useDroppable({ id: folderDropId(folder.id), disabled: disabledDrop });

  return (
    <span className="inline-flex min-w-0 shrink-0 items-center gap-1">
      <Icon icon={ChevronRight} size="xs" decorative className="text-icon opacity-55" />
      <button
        ref={drop.setNodeRef}
        type="button"
        className={cn(
          "inline-flex max-w-[12rem] shrink-0 items-center border border-transparent font-medium transition focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset sm:max-w-[18rem]",
          isDragActive ? "min-h-11 rounded-full border-dashed px-4" : "h-8 rounded-lg px-1.5",
          isCurrent ? "text-strong" : "text-default",
          isDragActive && !disabledDrop && "border-[var(--staffly-border)] bg-[color:var(--staffly-control)]/35",
          isDragActive && (disabledDrop || isDropCurrentFolder) && "opacity-60",
          !isDragActive && "hover:bg-[var(--staffly-control-hover)]",
          drop.isOver &&
            "border-[var(--staffly-ring)] bg-[var(--staffly-control-hover)] text-strong ring-2 ring-[var(--staffly-ring)] ring-inset",
        )}
        onClick={() => onOpenFolder(folder.id)}
        title={folder.name}
      >
        <span className="truncate">{folder.name}</span>
      </button>
    </span>
  );
}

function DishwarePageHeader({
  folder,
  onOpenTrash,
  onCreateFolder,
  onCreateInventory,
}: {
  folder: DishwareInventoryFolderDto | null;
  onOpenTrash: () => void;
  onCreateFolder: () => void;
  onCreateInventory: () => void;
}) {
  return (
    <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
      <div className="min-w-0">
        <h2 className="text-2xl font-semibold [overflow-wrap:anywhere]">{folder?.name ?? "Инвентаризации посуды"}</h2>
        <div className="text-muted text-sm">{folder?.description || "Папки и документы по посуде."}</div>
      </div>
      <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon icon={Archive} size="sm" decorative />}
          onClick={onOpenTrash}
        >
          Корзина
        </Button>
        <Button
          size="sm"
          variant="outline"
          leftIcon={<Icon icon={FolderPlus} size="sm" decorative />}
          onClick={onCreateFolder}
        >
          Папка
        </Button>
        <Button
          size="sm"
          className="col-span-2 sm:col-span-1"
          leftIcon={<Icon icon={Plus} size="sm" decorative />}
          onClick={onCreateInventory}
        >
          Инвентаризация
        </Button>
      </div>
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
          isDragActive && canDropInto && "ring-1 ring-transparent",
          isOver && "bg-[color:var(--staffly-control)]/60 ring-2 ring-[var(--staffly-ring)]",
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
          <span className="mt-0.5 inline-flex h-10 w-10 shrink-0 items-center justify-center rounded-2xl bg-[color:var(--staffly-control)] transition group-hover:bg-[color:var(--staffly-control-hover)]">
            <Icon icon={Folder} size="sm" decorative />
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
        <InventoryObjectActionsMenu
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
      {isOver ? (
        <div className="pointer-events-none absolute inset-x-3 bottom-3 flex justify-end">
          <span className="rounded-full bg-[color:var(--staffly-surface)] px-3 py-1 text-xs font-semibold text-default shadow-sm ring-1 ring-[var(--staffly-border)]">
            Отпустить в папку
          </span>
        </div>
      ) : null}
      </Card>
    </div>
  );
}

function InventoryMetric({ label, value }: { label: string; value: ReactNode }) {
  return (
    <div className="border-subtle rounded-2xl border bg-[color:var(--staffly-control)]/45 px-3 py-2">
      <div className="text-muted text-[11px] font-medium">{label}</div>
      <div className="mt-1 font-semibold tabular-nums">{value}</div>
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
      <Card
        className={cn(
          "group hover:bg-app rounded-[1.25rem] p-2.5 transition sm:p-3",
          isDragging && "opacity-0",
        )}
      >
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
                Дата: {formatDate(inventory.inventoryDate)}
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
        <InventoryObjectActionsMenu
          title={inventory.title}
          description={`Документ от ${formatDate(inventory.inventoryDate)}`}
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

function DishwareObjectList({
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

function DishwareDragOverlayCard({ object, width }: { object: DishwareObject | null; width: number | null }) {
  if (!object) return null;

  const title = object.kind === "folder" ? object.folder.name : object.inventory.title;
  const subtitle =
    object.kind === "folder"
      ? object.folder.description || "Папка"
      : `${formatDate(object.inventory.inventoryDate)} · ${
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

function EmptyFolderState() {
  return (
    <Card className="space-y-3">
      <div className="font-medium">Здесь пока пусто</div>
      <div className="text-muted text-sm">Создайте папку или новый документ инвентаризации.</div>
    </Card>
  );
}

function AuthorizedDishwareInventoriesPage() {
  const { user } = useAuth();
  const navigate = useNavigate();
  const restaurantId = user?.restaurantId ?? null;

  const [inventories, setInventories] = useState<DishwareInventorySummaryDto[]>([]);
  const [folders, setFolders] = useState<DishwareInventoryFolderDto[]>([]);
  const [trashInventories, setTrashInventories] = useState<DishwareInventorySummaryDto[]>([]);
  const [trashFolders, setTrashFolders] = useState<DishwareInventoryFolderDto[]>([]);
  const [currentFolderId, setCurrentFolderId] = useState<number | null>(null);
  const [loading, setLoading] = useState(false);
  const [trashLoading, setTrashLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [createError, setCreateError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [folderModal, setFolderModal] = useState<FolderModalState | null>(null);
  const [folderSubmitting, setFolderSubmitting] = useState(false);
  const [folderError, setFolderError] = useState<string | null>(null);
  const [moveTarget, setMoveTarget] = useState<MoveTarget | null>(null);
  const [moveSubmitting, setMoveSubmitting] = useState(false);
  const [moveError, setMoveError] = useState<string | null>(null);
  const [trashOpen, setTrashOpen] = useState(false);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [permanentDeleteTarget, setPermanentDeleteTarget] = useState<PermanentDeleteTarget | null>(null);
  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const sortableDnd = useSortableDnd({ scrollContainerRef });
  const [dndError, setDndError] = useState<string | null>(null);
  const [activeDishwareObject, setActiveDishwareObject] = useState<DishwareObject | null>(null);
  const [dragOverlayWidth, setDragOverlayWidth] = useState<number | null>(null);

  const folderMap = useMemo(() => new Map(folders.map((folder) => [folder.id, folder])), [folders]);
  const currentFolder = currentFolderId == null ? null : (folderMap.get(currentFolderId) ?? null);
  const folderChain = useMemo(() => buildFolderChain(currentFolder, folderMap), [currentFolder, folderMap]);

  const loadActive = useCallback(async () => {
    if (!restaurantId) return;
    setLoading(true);
    setError(null);
    try {
      const [nextFolders, nextInventories] = await Promise.all([
        listDishwareInventoryFolders(restaurantId),
        listDishwareInventories(restaurantId),
      ]);
      setFolders(nextFolders);
      setInventories(nextInventories);
      if (currentFolderId != null && !nextFolders.some((folder) => folder.id === currentFolderId)) {
        setCurrentFolderId(null);
      }
    } catch (e) {
      console.error("Failed to load dishware inventories", e);
      setError("Не удалось загрузить инвентаризации");
      setFolders([]);
      setInventories([]);
    } finally {
      setLoading(false);
    }
  }, [currentFolderId, restaurantId]);

  const loadTrash = useCallback(async () => {
    if (!restaurantId) return;
    setTrashLoading(true);
    try {
      const [nextFolders, nextInventories] = await Promise.all([
        listDishwareInventoryFolders(restaurantId, true),
        listDishwareInventoryTrash(restaurantId),
      ]);
      setTrashFolders(nextFolders);
      setTrashInventories(nextInventories);
    } catch (e) {
      console.error("Failed to load inventory trash", e);
    } finally {
      setTrashLoading(false);
    }
  }, [restaurantId]);

  useEffect(() => {
    void loadActive();
  }, [loadActive]);

  useEffect(() => {
    if (trashOpen) void loadTrash();
  }, [loadTrash, trashOpen]);

  const childFolders = useMemo(
    () => folders.filter((folder) => folder.parentId === currentFolderId),
    [currentFolderId, folders],
  );
  const currentInventories = useMemo(
    () => inventories.filter((inventory) => (inventory.folderId ?? null) === currentFolderId),
    [currentFolderId, inventories],
  );
  const currentObjects = useMemo<DishwareObject[]>(
    () =>
      [
        ...childFolders.map((folder) => ({
          kind: "folder" as const,
          id: folder.id,
          sortOrder: folder.sortOrder ?? 0,
          folder,
        })),
        ...currentInventories.map((inventory) => ({
          kind: "inventory" as const,
          id: inventory.id,
          sortOrder: inventory.sortOrder ?? 0,
          inventory,
        })),
      ].sort(sortDishwareObjects),
    [childFolders, currentInventories],
  );
  const currentObjectIds = useMemo(
    () => currentObjects.map((object) => objectId(object.kind, object.id)),
    [currentObjects],
  );
  const sourceOptions = useMemo(
    () => inventories.filter((inventory) => inventory.status === "COMPLETED"),
    [inventories],
  );
  const blockedDropFolderIds = useMemo(() => {
    const parsed = sortableDnd.activeId ? parseObjectId(sortableDnd.activeId) : null;
    if (!parsed || parsed.kind !== "folder") return new Set<number>();
    return descendantIds(parsed.id, folders);
  }, [folders, sortableDnd.activeId]);

  const handleCreate = useCallback(
    async (payload: CreateDishwareInventoryRequest) => {
      if (!restaurantId) return;
      setCreating(true);
      setCreateError(null);
      try {
        const created = await createDishwareInventory(restaurantId, payload);
        setCreateOpen(false);
        await loadActive();
        navigate(`/inventories/dishware/${created.id}`);
      } catch (e: any) {
        console.error("Failed to create dishware inventory", e);
        setCreateError(e?.friendlyMessage || "Не удалось создать инвентаризацию");
      } finally {
        setCreating(false);
      }
    },
    [loadActive, navigate, restaurantId],
  );

  const handleSaveFolder = useCallback(
    async (payload: { name: string; description: string | null }) => {
      if (!restaurantId || !folderModal) return;
      setFolderSubmitting(true);
      setFolderError(null);
      try {
        if (folderModal.mode === "create") {
          await createDishwareInventoryFolder(restaurantId, {
            parentId: folderModal.parentId,
            name: payload.name,
            description: payload.description,
          });
        } else {
          await updateDishwareInventoryFolder(restaurantId, folderModal.folder.id, payload);
        }
        setFolderModal(null);
        await loadActive();
      } catch (e: any) {
        setFolderError(e?.friendlyMessage || "Не удалось сохранить папку");
      } finally {
        setFolderSubmitting(false);
      }
    },
    [folderModal, loadActive, restaurantId],
  );

  const handleMove = useCallback(
    async (folderId: number | null) => {
      if (!restaurantId || !moveTarget) return;
      setMoveSubmitting(true);
      setMoveError(null);
      try {
        if (moveTarget.kind === "folder") {
          await moveDishwareInventoryFolder(restaurantId, moveTarget.id, folderId);
        } else {
          await moveDishwareInventory(restaurantId, moveTarget.id, folderId);
        }
        setMoveTarget(null);
        await loadActive();
      } catch (e: any) {
        setMoveError(e?.friendlyMessage || "Не удалось переместить");
      } finally {
        setMoveSubmitting(false);
      }
    },
    [loadActive, moveTarget, restaurantId],
  );

  const applyObjectSortOrders = useCallback((orderedObjects: DishwareObject[]) => {
    const orderMap = new Map(orderedObjects.map((object, index) => [objectId(object.kind, object.id), index]));
    setFolders((prev) =>
      prev.map((folder) => {
        const nextSortOrder = orderMap.get(objectId("folder", folder.id));
        return nextSortOrder == null ? folder : { ...folder, sortOrder: nextSortOrder };
      }),
    );
    setInventories((prev) =>
      prev.map((inventory) => {
        const nextSortOrder = orderMap.get(objectId("inventory", inventory.id));
        return nextSortOrder == null ? inventory : { ...inventory, sortOrder: nextSortOrder };
      }),
    );
  }, []);

  const finishDishwareDrag = useCallback(() => {
    sortableDnd.finishDrag();
    setActiveDishwareObject(null);
    setDragOverlayWidth(null);
  }, [sortableDnd]);

  const handleDishwareDragStart = useCallback(
    (event: DragStartEvent) => {
      sortableDnd.handleDragStart(event);
      const activeId = String(event.active.id);
      setActiveDishwareObject(currentObjects.find((object) => objectId(object.kind, object.id) === activeId) ?? null);
      setDragOverlayWidth(event.active.rect.current.initial?.width ?? null);
    },
    [currentObjects, sortableDnd],
  );

  const handleDishwareDragEnd = useCallback(
    async (event: DragEndEvent) => {
      const active = parseObjectId(String(event.active.id));
      const overId = event.over ? String(event.over.id) : null;
      finishDishwareDrag();
      if (!restaurantId || !active || !overId) return;

      setDndError(null);
      const dropFolderId = parseFolderDropId(overId);
      if (overId.startsWith("folder-drop:")) {
        if (dropFolderId === undefined) return;
        if (active.kind === "folder" && dropFolderId != null && blockedDropFolderIds.has(dropFolderId)) return;
        if (dropFolderId === currentFolderId) return;

        try {
          if (active.kind === "folder") {
            await moveDishwareInventoryFolder(restaurantId, active.id, dropFolderId);
          } else {
            await moveDishwareInventory(restaurantId, active.id, dropFolderId);
          }
          await loadActive();
        } catch (e: any) {
          console.error("Failed to move dishware object with drag and drop", e);
          setDndError(e?.friendlyMessage || "Не удалось переместить объект");
          await loadActive();
        }
        return;
      }

      const oldIndex = currentObjectIds.indexOf(objectId(active.kind, active.id));
      const newIndex = currentObjectIds.indexOf(overId);
      if (oldIndex === -1 || newIndex === -1 || oldIndex === newIndex) return;

      const nextObjects = arrayMove(currentObjects, oldIndex, newIndex).map((object, index) => ({
        ...object,
        sortOrder: index,
      }));
      applyObjectSortOrders(nextObjects);

      try {
        await reorderDishwareInventoryObjects(restaurantId, {
          folderId: currentFolderId,
          objects: nextObjects.map((object, index) => ({
            kind: object.kind,
            id: object.id,
            sortOrder: index,
          })),
        });
        await loadActive();
      } catch (e: any) {
        console.error("Failed to reorder dishware objects", e);
        setDndError(e?.friendlyMessage || "Не удалось сохранить порядок");
        await loadActive();
      }
    },
    [
      applyObjectSortOrders,
      blockedDropFolderIds,
      currentFolderId,
      currentObjectIds,
      currentObjects,
      finishDishwareDrag,
      loadActive,
      restaurantId,
    ],
  );

  const handleDishwareDragCancel = useCallback(() => {
    finishDishwareDrag();
  }, [finishDishwareDrag]);

  const runTrashFolder = useCallback(
    async (folder: DishwareInventoryFolderDto) => {
      if (!restaurantId) return;
      setActionLoading(`trash-folder-${folder.id}`);
      try {
        await trashDishwareInventoryFolder(restaurantId, folder.id);
        if (currentFolderId === folder.id) setCurrentFolderId(folder.parentId ?? null);
        await loadActive();
      } finally {
        setActionLoading(null);
      }
    },
    [currentFolderId, loadActive, restaurantId],
  );

  const runTrashInventory = useCallback(
    async (inventory: DishwareInventorySummaryDto) => {
      if (!restaurantId) return;
      setActionLoading(`trash-inventory-${inventory.id}`);
      try {
        await trashDishwareInventory(restaurantId, inventory.id);
        await loadActive();
      } finally {
        setActionLoading(null);
      }
    },
    [loadActive, restaurantId],
  );

  const runRestoreFolder = useCallback(
    async (folder: DishwareInventoryFolderDto) => {
      if (!restaurantId) return;
      setActionLoading(`restore-folder-${folder.id}`);
      try {
        await restoreDishwareInventoryFolder(restaurantId, folder.id);
        await Promise.all([loadActive(), loadTrash()]);
      } finally {
        setActionLoading(null);
      }
    },
    [loadActive, loadTrash, restaurantId],
  );

  const runRestoreInventory = useCallback(
    async (inventory: DishwareInventorySummaryDto) => {
      if (!restaurantId) return;
      setActionLoading(`restore-inventory-${inventory.id}`);
      try {
        await restoreDishwareInventory(restaurantId, inventory.id);
        await Promise.all([loadActive(), loadTrash()]);
      } finally {
        setActionLoading(null);
      }
    },
    [loadActive, loadTrash, restaurantId],
  );

  const runPermanentDelete = useCallback(async () => {
    if (!restaurantId || !permanentDeleteTarget) return;
    setActionLoading(
      permanentDeleteTarget.kind === "all"
        ? "delete-all"
        : `delete-${permanentDeleteTarget.kind}-${permanentDeleteTarget.id}`,
    );
    try {
      if (permanentDeleteTarget.kind === "all") {
        const folderRoots = rootTrashedFolders(trashFolders);
        const deletedFolderIds = new Set<number>();
        folderRoots.forEach((folder) => {
          descendantIds(folder.id, trashFolders).forEach((id) => deletedFolderIds.add(id));
        });
        await Promise.all(folderRoots.map((folder) => deleteDishwareInventoryFolder(restaurantId, folder.id)));
        await Promise.all(
          trashInventories
            .filter((inventory) => inventory.folderId == null || !deletedFolderIds.has(inventory.folderId))
            .map((inventory) => deleteDishwareInventory(restaurantId, inventory.id)),
        );
      } else if (permanentDeleteTarget.kind === "folder") {
        await deleteDishwareInventoryFolder(restaurantId, permanentDeleteTarget.id);
      } else {
        await deleteDishwareInventory(restaurantId, permanentDeleteTarget.id);
      }
      setPermanentDeleteTarget(null);
      await Promise.all([loadActive(), loadTrash()]);
    } finally {
      setActionLoading(null);
    }
  }, [loadActive, loadTrash, permanentDeleteTarget, restaurantId, trashFolders, trashInventories]);

  return (
    <div className="mx-auto max-w-5xl space-y-4">
      <DndContext
        sensors={sortableDnd.sensors}
        collisionDetection={dishwareCollisionDetection}
        measuring={{ droppable: { strategy: MeasuringStrategy.Always } }}
        onDragStart={handleDishwareDragStart}
        onDragMove={sortableDnd.handleDragMove}
        onDragEnd={(event) => void handleDishwareDragEnd(event)}
        onDragCancel={handleDishwareDragCancel}
      >
        <DishwareBreadcrumbs
          currentFolderId={currentFolderId}
          folderChain={folderChain}
          activeObjectId={sortableDnd.activeId}
          blockedFolderIds={blockedDropFolderIds}
          onBackToInventories={() => navigate("/inventories")}
          onOpenRoot={() => setCurrentFolderId(null)}
          onOpenFolder={setCurrentFolderId}
        />

        <DishwarePageHeader
          folder={currentFolder}
          onOpenTrash={() => setTrashOpen(true)}
          onCreateFolder={() => {
            setFolderError(null);
            setFolderModal({ mode: "create", parentId: currentFolderId });
          }}
          onCreateInventory={() => setCreateOpen(true)}
        />

        {loading ? <Card className="text-muted text-sm">Загружаем инвентаризации...</Card> : null}
        {!loading && error ? <Card className="text-sm text-red-600">{error}</Card> : null}
        {dndError ? <Card className="text-sm text-red-600">{dndError}</Card> : null}

        {!loading && !error && currentObjects.length === 0 ? <EmptyFolderState /> : null}

        {!loading && !error && currentObjects.length > 0 ? (
          <div ref={scrollContainerRef}>
            <SortableContext items={currentObjectIds} strategy={verticalListSortingStrategy}>
              <DishwareObjectList
                objects={currentObjects}
                activeObjectId={sortableDnd.activeId}
                blockedFolderIds={blockedDropFolderIds}
                actionLoading={actionLoading}
                onOpenFolder={setCurrentFolderId}
                onOpenInventory={(inventoryId) => navigate(`/inventories/dishware/${inventoryId}`)}
                onEditFolder={(folder) => {
                  setFolderError(null);
                  setFolderModal({ mode: "edit", parentId: folder.parentId, folder });
                }}
                onMoveFolder={(folder) => {
                  setMoveError(null);
                  setMoveTarget({ kind: "folder", id: folder.id, title: folder.name });
                }}
                onMoveInventory={(inventory) => {
                  setMoveError(null);
                  setMoveTarget({ kind: "inventory", id: inventory.id, title: inventory.title });
                }}
                onTrashFolder={(folder) => void runTrashFolder(folder)}
                onTrashInventory={(inventory) => void runTrashInventory(inventory)}
              />
            </SortableContext>
          </div>
        ) : null}

        <DragOverlay dropAnimation={null}>
          <DishwareDragOverlayCard object={activeDishwareObject} width={dragOverlayWidth} />
        </DragOverlay>
      </DndContext>

      <CreateDishwareInventoryModal
        open={createOpen}
        sourceOptions={sourceOptions}
        folderOptions={folders}
        initialFolderId={currentFolderId}
        submitting={creating}
        error={createError}
        onClose={() => {
          if (creating) return;
          setCreateOpen(false);
          setCreateError(null);
        }}
        onSubmit={handleCreate}
      />

      <FolderEditorModal
        state={folderModal}
        submitting={folderSubmitting}
        error={folderError}
        onClose={() => {
          if (folderSubmitting) return;
          setFolderModal(null);
          setFolderError(null);
        }}
        onSubmit={handleSaveFolder}
      />

      <MoveModal
        target={moveTarget}
        folders={folders}
        currentFolderId={currentFolderId}
        submitting={moveSubmitting}
        error={moveError}
        onClose={() => {
          if (moveSubmitting) return;
          setMoveTarget(null);
          setMoveError(null);
        }}
        onSubmit={handleMove}
      />

      <TrashModal
        open={trashOpen}
        folders={trashFolders}
        inventories={trashInventories}
        loading={trashLoading}
        actionLoading={actionLoading}
        onClose={() => setTrashOpen(false)}
        onRestoreFolder={(folder) => void runRestoreFolder(folder)}
        onRestoreInventory={(inventory) => void runRestoreInventory(inventory)}
        onDeleteFolder={(folder) => setPermanentDeleteTarget({ kind: "folder", id: folder.id, title: folder.name })}
        onDeleteInventory={(inventory) =>
          setPermanentDeleteTarget({ kind: "inventory", id: inventory.id, title: inventory.title })
        }
        onDeleteAll={() => setPermanentDeleteTarget({ kind: "all", title: "все элементы корзины" })}
      />

      <ConfirmDialog
        open={Boolean(permanentDeleteTarget)}
        title="Удалить навсегда"
        description={
          permanentDeleteTarget?.kind === "all"
            ? "Все папки, документы и фото в корзине будут удалены безвозвратно."
            : permanentDeleteTarget?.kind === "folder"
              ? "Папка, все вложенные папки, документы и фото внутри будут удалены безвозвратно."
              : "Документ, все строки и фото будут удалены безвозвратно."
        }
        confirming={Boolean(actionLoading?.startsWith("delete-"))}
        confirmText="Удалить навсегда"
        onCancel={() => {
          if (actionLoading?.startsWith("delete-")) return;
          setPermanentDeleteTarget(null);
        }}
        onConfirm={() => void runPermanentDelete()}
      />
    </div>
  );
}

export default function DishwareInventoriesPage() {
  return (
    <InventoryAccessGuard>
      <AuthorizedDishwareInventoriesPage />
    </InventoryAccessGuard>
  );
}
