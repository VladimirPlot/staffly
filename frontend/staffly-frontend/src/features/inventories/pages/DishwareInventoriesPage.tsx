import { useCallback, useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Archive, ArrowLeft, ChevronRight, Edit3, Folder, FolderPlus, MoveRight, Plus, RotateCcw, Trash2 } from "lucide-react";

import { useAuth } from "../../../shared/providers/AuthProvider";
import Button from "../../../shared/ui/Button";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import DropdownSelect from "../../../shared/ui/DropdownSelect";
import Icon from "../../../shared/ui/Icon";
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

type MoveTarget =
  | { kind: "folder"; id: number; title: string }
  | { kind: "inventory"; id: number; title: string };

type PermanentDeleteTarget =
  | { kind: "folder"; id: number; title: string }
  | { kind: "inventory"; id: number; title: string }
  | { kind: "all"; title: string };

function formatDate(value: string): string {
  return formatDateFromIso(value);
}

function sortFolders(a: DishwareInventoryFolderDto, b: DishwareInventoryFolderDto) {
  return (a.sortOrder ?? 0) - (b.sortOrder ?? 0) || a.name.localeCompare(b.name, "ru");
}

function buildFolderChain(folder: DishwareInventoryFolderDto | null, folderMap: Map<number, DishwareInventoryFolderDto>) {
  const chain: DishwareInventoryFolderDto[] = [];
  const seen = new Set<number>();
  let cursor = folder;
  while (cursor && !seen.has(cursor.id)) {
    chain.unshift(cursor);
    seen.add(cursor.id);
    cursor = cursor.parentId == null ? null : folderMap.get(cursor.parentId) ?? null;
  }
  return chain;
}

function getFolderPathLabel(folder: DishwareInventoryFolderDto, folderMap: Map<number, DishwareInventoryFolderDto>) {
  return buildFolderChain(folder, folderMap).map((item) => item.name).join(" / ");
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
    setDescription(state.mode === "edit" ? state.folder.description ?? "" : "");
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
          <div className="flex items-center justify-between gap-3 border-b border-subtle pb-3">
            <div className="text-sm text-muted">
              {trashedFolders.length + inventories.length} элементов в корзине
            </div>
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
        {loading ? <div className="text-sm text-muted">Загружаем корзину...</div> : null}
        {!loading && trashedFolders.length === 0 && inventories.length === 0 ? (
          <div className="text-sm text-muted">Корзина пуста.</div>
        ) : null}

        {trashedFolders.map((folder) => (
          <div key={`folder-${folder.id}`} className="rounded-2xl border border-subtle bg-app p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="flex items-center gap-2 font-medium">
                  <Icon icon={Folder} size="sm" decorative />
                  <span className="min-w-0 [overflow-wrap:anywhere]">{folder.name}</span>
                </div>
                {folder.description ? <div className="mt-1 text-sm text-muted">{folder.description}</div> : null}
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
          <div key={`inventory-${inventory.id}`} className="rounded-2xl border border-subtle bg-app p-3">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
              <div className="min-w-0">
                <div className="font-medium [overflow-wrap:anywhere]">{inventory.title}</div>
                <div className="mt-1 text-sm text-muted">Дата: {formatDate(inventory.inventoryDate)}</div>
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
  const currentFolder = currentFolderId == null ? null : folderMap.get(currentFolderId) ?? null;
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

  const handleCreate = useCallback(async (payload: CreateDishwareInventoryRequest) => {
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
  }, [loadActive, navigate, restaurantId]);

  const handleSaveFolder = useCallback(async (payload: { name: string; description: string | null }) => {
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
  }, [folderModal, loadActive, restaurantId]);

  const handleMove = useCallback(async (folderId: number | null) => {
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
  }, [loadActive, moveTarget, restaurantId]);

  const runTrashFolder = useCallback(async (folder: DishwareInventoryFolderDto) => {
    if (!restaurantId) return;
    setActionLoading(`trash-folder-${folder.id}`);
    try {
      await trashDishwareInventoryFolder(restaurantId, folder.id);
      if (currentFolderId === folder.id) setCurrentFolderId(folder.parentId ?? null);
      await loadActive();
    } finally {
      setActionLoading(null);
    }
  }, [currentFolderId, loadActive, restaurantId]);

  const runTrashInventory = useCallback(async (inventory: DishwareInventorySummaryDto) => {
    if (!restaurantId) return;
    setActionLoading(`trash-inventory-${inventory.id}`);
    try {
      await trashDishwareInventory(restaurantId, inventory.id);
      await loadActive();
    } finally {
      setActionLoading(null);
    }
  }, [loadActive, restaurantId]);

  const runRestoreFolder = useCallback(async (folder: DishwareInventoryFolderDto) => {
    if (!restaurantId) return;
    setActionLoading(`restore-folder-${folder.id}`);
    try {
      await restoreDishwareInventoryFolder(restaurantId, folder.id);
      await Promise.all([loadActive(), loadTrash()]);
    } finally {
      setActionLoading(null);
    }
  }, [loadActive, loadTrash, restaurantId]);

  const runRestoreInventory = useCallback(async (inventory: DishwareInventorySummaryDto) => {
    if (!restaurantId) return;
    setActionLoading(`restore-inventory-${inventory.id}`);
    try {
      await restoreDishwareInventory(restaurantId, inventory.id);
      await Promise.all([loadActive(), loadTrash()]);
    } finally {
      setActionLoading(null);
    }
  }, [loadActive, loadTrash, restaurantId]);

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
      <div className="space-y-2">
        <nav
          aria-label="Путь к папке"
          className="-mx-1 flex min-w-0 items-center gap-1 overflow-x-auto px-1 py-1 text-sm text-muted [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
        >
          <Link
            to="/app"
            className="inline-flex h-8 shrink-0 items-center gap-1 rounded-lg px-1.5 font-medium text-default transition hover:bg-[var(--staffly-control-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] focus:ring-inset"
          >
            <Icon icon={ArrowLeft} size="xs" decorative className="text-icon" />
            Главная
          </Link>
          <Icon icon={ChevronRight} size="xs" decorative className="shrink-0 text-icon opacity-55" />
          <button
            type="button"
            className="h-8 shrink-0 rounded-lg px-1.5 font-medium text-default transition hover:bg-[var(--staffly-control-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] focus:ring-inset"
            onClick={() => navigate("/inventories")}
          >
            Инвентаризации
          </button>
          <Icon icon={ChevronRight} size="xs" decorative className="shrink-0 text-icon opacity-55" />
          <button
            type="button"
            className={
              "h-8 shrink-0 rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] focus:ring-inset " +
              (currentFolderId == null ? "text-strong" : "text-default")
            }
            onClick={() => setCurrentFolderId(null)}
          >
            Посуда
          </button>
          {folderChain.map((folder, index) => (
            <span key={folder.id} className="inline-flex min-w-0 shrink-0 items-center gap-1">
              <Icon icon={ChevronRight} size="xs" decorative className="text-icon opacity-55" />
              <button
                type="button"
                className={
                  "h-8 max-w-[12rem] truncate rounded-lg px-1.5 font-medium transition hover:bg-[var(--staffly-control-hover)] focus:outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] focus:ring-inset sm:max-w-[18rem] " +
                  (index === folderChain.length - 1 ? "text-strong" : "text-default")
                }
                onClick={() => setCurrentFolderId(folder.id)}
                title={folder.name}
              >
                {folder.name}
              </button>
            </span>
          ))}
        </nav>
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h2 className="text-2xl font-semibold [overflow-wrap:anywhere]">
            {currentFolder?.name ?? "Инвентаризации посуды"}
          </h2>
          <div className="text-sm text-muted">
            {currentFolder?.description || "Папки и документы по посуде."}
          </div>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex sm:items-center">
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Icon icon={Archive} size="sm" decorative />}
            onClick={() => setTrashOpen(true)}
          >
            Корзина
          </Button>
          <Button
            size="sm"
            variant="outline"
            leftIcon={<Icon icon={FolderPlus} size="sm" decorative />}
            onClick={() => {
              setFolderError(null);
              setFolderModal({ mode: "create", parentId: currentFolderId });
            }}
          >
            Папка
          </Button>
          <Button
            size="sm"
            className="col-span-2 sm:col-span-1"
            leftIcon={<Icon icon={Plus} size="sm" decorative />}
            onClick={() => setCreateOpen(true)}
          >
            Инвентаризация
          </Button>
        </div>
      </div>

      {loading ? <Card className="text-sm text-muted">Загружаем инвентаризации...</Card> : null}
      {!loading && error ? <Card className="text-sm text-red-600">{error}</Card> : null}

      {!loading && !error && childFolders.length === 0 && currentInventories.length === 0 ? (
        <Card className="space-y-3">
          <div className="font-medium">Здесь пока пусто</div>
          <div className="text-sm text-muted">Создайте папку или новый документ инвентаризации.</div>
        </Card>
      ) : null}

      {!loading && !error && childFolders.length > 0 ? (
        <div className="grid gap-3 md:grid-cols-2">
          {childFolders.map((folder) => (
            <Card key={folder.id} className="rounded-[1.25rem] p-3 sm:p-4">
              <div className="flex flex-col gap-3">
                <button
                  type="button"
                  className="flex min-w-0 items-start gap-3 text-left"
                  onClick={() => setCurrentFolderId(folder.id)}
                >
                  <span className="mt-0.5 inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-xl bg-[color:var(--staffly-control)]">
                    <Icon icon={Folder} size="sm" decorative />
                  </span>
                  <span className="min-w-0">
                    <span className="block font-semibold [overflow-wrap:anywhere]">{folder.name}</span>
                    {folder.description ? (
                      <span className="mt-1 block text-sm text-muted [overflow-wrap:anywhere]">{folder.description}</span>
                    ) : null}
                  </span>
                </button>
                <div className="grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                  <Button size="sm" variant="outline" onClick={() => setCurrentFolderId(folder.id)}>
                    Открыть
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Icon icon={Edit3} size="sm" decorative />}
                    onClick={() => {
                      setFolderError(null);
                      setFolderModal({ mode: "edit", parentId: folder.parentId, folder });
                    }}
                  >
                    Изменить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    leftIcon={<Icon icon={MoveRight} size="sm" decorative />}
                    onClick={() => {
                      setMoveError(null);
                      setMoveTarget({ kind: "folder", id: folder.id, title: folder.name });
                    }}
                  >
                    Переместить
                  </Button>
                  <Button
                    size="sm"
                    variant="outline"
                    className="text-red-600"
                    isLoading={actionLoading === `trash-folder-${folder.id}`}
                    leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                    onClick={() => void runTrashFolder(folder)}
                  >
                    В корзину
                  </Button>
                </div>
              </div>
            </Card>
          ))}
        </div>
      ) : null}

      {!loading && !error && currentInventories.length > 0 ? (
        <div className="space-y-3">
          {currentInventories.map((inventory) => (
            <Card key={inventory.id} className="rounded-[1.25rem] p-3 sm:p-4">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <Link to={`/inventories/dishware/${inventory.id}`} className="text-lg font-semibold [overflow-wrap:anywhere] hover:underline">
                      {inventory.title}
                    </Link>
                    <span className={getInventoryStatusBadgeClass(inventory.status)}>
                      {inventory.status === "COMPLETED" ? "Завершена" : "Черновик"}
                    </span>
                  </div>
                  <div className="mt-1 text-sm text-muted">
                    Дата: {formatDate(inventory.inventoryDate)}
                    {inventory.sourceInventoryTitle ? ` • На основе: ${inventory.sourceInventoryTitle}` : ""}
                  </div>
                  {inventory.comment ? <div className="mt-2 text-sm text-default [overflow-wrap:anywhere]">{inventory.comment}</div> : null}
                </div>

                <div className="grid grid-cols-3 gap-2 lg:min-w-[300px]">
                  <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted">Позиции</div>
                    <div className="mt-1 font-semibold tabular-nums">{inventory.itemsCount}</div>
                  </div>
                  <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted">Потери</div>
                    <div className="mt-1 font-semibold tabular-nums">{formatInventoryLossCount(inventory.totalLossQty)}</div>
                  </div>
                  <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
                    <div className="text-[11px] font-medium text-muted">Сумма</div>
                    <div className="mt-1 font-semibold tabular-nums">{formatInventoryLossAmount(inventory.totalLossAmount)}</div>
                  </div>
                </div>
              </div>

              <div className="mt-3 grid grid-cols-2 gap-2 sm:flex sm:flex-wrap">
                <Button size="sm" variant="outline" onClick={() => navigate(`/inventories/dishware/${inventory.id}`)}>
                  Открыть
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  leftIcon={<Icon icon={MoveRight} size="sm" decorative />}
                  onClick={() => {
                    setMoveError(null);
                    setMoveTarget({ kind: "inventory", id: inventory.id, title: inventory.title });
                  }}
                >
                  Переместить
                </Button>
                <Button
                  size="sm"
                  variant="outline"
                  className="text-red-600"
                  isLoading={actionLoading === `trash-inventory-${inventory.id}`}
                  leftIcon={<Icon icon={Trash2} size="sm" decorative />}
                  onClick={() => void runTrashInventory(inventory)}
                >
                  В корзину
                </Button>
              </div>
            </Card>
          ))}
        </div>
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
        onDeleteInventory={(inventory) => setPermanentDeleteTarget({ kind: "inventory", id: inventory.id, title: inventory.title })}
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
