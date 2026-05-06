import { DndContext, DragOverlay, MeasuringStrategy, type DragEndEvent, type DragStartEvent } from "@dnd-kit/core";
import { arrayMove, SortableContext, verticalListSortingStrategy } from "@dnd-kit/sortable";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";

import { useSortableDnd } from "../../../shared/hooks/useSortableDnd";
import { useAuth } from "../../../shared/providers/AuthProvider";
import Card from "../../../shared/ui/Card";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
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
import DishwareBreadcrumbs from "../components/DishwareBreadcrumbs";
import CreateDishwareInventoryModal from "../components/CreateDishwareInventoryModal";
import DishwareFolderEditorModal from "../components/DishwareFolderEditorModal";
import DishwareInventoriesHeader from "../components/DishwareInventoriesHeader";
import DishwareMoveModal from "../components/DishwareMoveModal";
import DishwareObjectList, { DishwareDragOverlayCard } from "../components/DishwareObjectList";
import DishwareTrashModal from "../components/DishwareTrashModal";
import InventoryAccessGuard from "../components/InventoryAccessGuard";
import { buildFolderChain, descendantIds, rootTrashedFolders } from "../dishwareInventoryFolders";
import {
  dishwareCollisionDetection,
  objectId,
  parseFolderDropId,
  parseObjectId,
  sortDishwareObjects,
} from "../dishwareInventoriesDnd";
import type { DishwareObject, FolderModalState, MoveTarget, PermanentDeleteTarget } from "../dishwareInventoriesTypes";

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

        <DishwareInventoriesHeader
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

      <DishwareFolderEditorModal
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

      <DishwareMoveModal
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

      <DishwareTrashModal
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
