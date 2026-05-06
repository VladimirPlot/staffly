import { useCallback, useEffect, useMemo, useState, type ReactNode } from "react";
import { Link, useNavigate } from "react-router-dom";
import {
  Archive,
  ArrowLeft,
  ChevronRight,
  Edit3,
  ExternalLink,
  Folder,
  FolderPlus,
  MoreVertical,
  MoveRight,
  Plus,
  RotateCcw,
  Trash2,
} from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
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
  onBackToInventories,
  onOpenRoot,
  onOpenFolder,
}: {
  currentFolderId: number | null;
  folderChain: DishwareInventoryFolderDto[];
  onBackToInventories: () => void;
  onOpenRoot: () => void;
  onOpenFolder: (folderId: number) => void;
}) {
  return (
    <nav
      aria-label="Путь к папке"
      className="text-muted -mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-1 text-sm [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
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
        type="button"
        className={
          "h-8 shrink-0 rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset " +
          (currentFolderId == null ? "text-strong" : "text-default")
        }
        onClick={onOpenRoot}
      >
        Посуда
      </button>
      {folderChain.map((folder, index) => (
        <span key={folder.id} className="inline-flex min-w-0 shrink-0 items-center gap-1">
          <Icon icon={ChevronRight} size="xs" decorative className="text-icon opacity-55" />
          <button
            type="button"
            className={
              "h-8 max-w-[12rem] truncate rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:ring-2 focus:ring-[var(--staffly-ring)] focus:outline-none focus:ring-inset sm:max-w-[18rem] " +
              (index === folderChain.length - 1 ? "text-strong" : "text-default")
            }
            onClick={() => onOpenFolder(folder.id)}
            title={folder.name}
          >
            {folder.name}
          </button>
        </span>
      ))}
    </nav>
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
  onOpen,
  onEdit,
  onMove,
  onTrash,
}: {
  folder: DishwareInventoryFolderDto;
  actionLoading: string | null;
  onOpen: (folderId: number) => void;
  onEdit: (folder: DishwareInventoryFolderDto) => void;
  onMove: (folder: DishwareInventoryFolderDto) => void;
  onTrash: (folder: DishwareInventoryFolderDto) => void;
}) {
  const trashActionKey = `trash-folder-${folder.id}`;

  return (
    <Card className="group hover:bg-app rounded-[1.25rem] p-2.5 transition sm:p-3">
      <div className="flex items-start gap-2">
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
    </Card>
  );
}

function FolderGrid({
  folders,
  actionLoading,
  onOpen,
  onEdit,
  onMove,
  onTrash,
}: {
  folders: DishwareInventoryFolderDto[];
  actionLoading: string | null;
  onOpen: (folderId: number) => void;
  onEdit: (folder: DishwareInventoryFolderDto) => void;
  onMove: (folder: DishwareInventoryFolderDto) => void;
  onTrash: (folder: DishwareInventoryFolderDto) => void;
}) {
  if (folders.length === 0) return null;

  return (
    <div className="grid gap-3 md:grid-cols-2">
      {folders.map((folder) => (
        <FolderCard
          key={folder.id}
          folder={folder}
          actionLoading={actionLoading}
          onOpen={onOpen}
          onEdit={onEdit}
          onMove={onMove}
          onTrash={onTrash}
        />
      ))}
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
  onOpen,
  onMove,
  onTrash,
}: {
  inventory: DishwareInventorySummaryDto;
  actionLoading: string | null;
  onOpen: (inventoryId: number) => void;
  onMove: (inventory: DishwareInventorySummaryDto) => void;
  onTrash: (inventory: DishwareInventorySummaryDto) => void;
}) {
  const trashActionKey = `trash-inventory-${inventory.id}`;

  return (
    <Card className="group hover:bg-app rounded-[1.25rem] p-2.5 transition sm:p-3">
      <div className="flex items-start gap-2">
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
  );
}

function InventoryList({
  inventories,
  actionLoading,
  onOpen,
  onMove,
  onTrash,
}: {
  inventories: DishwareInventorySummaryDto[];
  actionLoading: string | null;
  onOpen: (inventoryId: number) => void;
  onMove: (inventory: DishwareInventorySummaryDto) => void;
  onTrash: (inventory: DishwareInventorySummaryDto) => void;
}) {
  if (inventories.length === 0) return null;

  return (
    <div className="space-y-3">
      {inventories.map((inventory) => (
        <InventoryCard
          key={inventory.id}
          inventory={inventory}
          actionLoading={actionLoading}
          onOpen={onOpen}
          onMove={onMove}
          onTrash={onTrash}
        />
      ))}
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
    () => folders.filter((folder) => folder.parentId === currentFolderId).sort(sortFolders),
    [currentFolderId, folders],
  );
  const currentInventories = useMemo(
    () => inventories.filter((inventory) => (inventory.folderId ?? null) === currentFolderId),
    [currentFolderId, inventories],
  );
  const sourceOptions = useMemo(
    () => inventories.filter((inventory) => inventory.status === "COMPLETED"),
    [inventories],
  );

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
      <DishwareBreadcrumbs
        currentFolderId={currentFolderId}
        folderChain={folderChain}
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

      {!loading && !error && childFolders.length === 0 && currentInventories.length === 0 ? <EmptyFolderState /> : null}

      {!loading && !error && childFolders.length > 0 ? (
        <FolderGrid
          folders={childFolders}
          actionLoading={actionLoading}
          onOpen={setCurrentFolderId}
          onEdit={(folder) => {
            setFolderError(null);
            setFolderModal({ mode: "edit", parentId: folder.parentId, folder });
          }}
          onMove={(folder) => {
            setMoveError(null);
            setMoveTarget({ kind: "folder", id: folder.id, title: folder.name });
          }}
          onTrash={(folder) => void runTrashFolder(folder)}
        />
      ) : null}

      {!loading && !error && currentInventories.length > 0 ? (
        <InventoryList
          inventories={currentInventories}
          actionLoading={actionLoading}
          onOpen={(inventoryId) => navigate(`/inventories/dishware/${inventoryId}`)}
          onMove={(inventory) => {
            setMoveError(null);
            setMoveTarget({ kind: "inventory", id: inventory.id, title: inventory.title });
          }}
          onTrash={(inventory) => void runTrashInventory(inventory)}
        />
      ) : null}

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
