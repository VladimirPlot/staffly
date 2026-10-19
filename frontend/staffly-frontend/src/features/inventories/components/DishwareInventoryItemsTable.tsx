import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../../shared/lib/cn";
import ConfirmDialog from "../../../shared/ui/ConfirmDialog";
import Button from "../../../shared/ui/Button";
import { useGridNavigation } from "../../../shared/ui/gridNavigation/useGridNavigation";
import type { DishwareInventoryEditableItem } from "../dishwareInventoryItems";
import { useDishwarePhotoDialogs } from "../hooks/useDishwarePhotoDialogs";
import MobileDishwareItem from "./dishwareInventoryItemsTable/MobileDishwareItem";
import DishwareInventoryItemRow from "./dishwareInventoryItemsTable/DishwareInventoryItemRow";
import FloatingAddButton from "./dishwareInventoryItemsTable/FloatingAddButton";
import NoteModal from "./dishwareInventoryItemsTable/NoteModal";
import {
  ADD_DOCK_REVEAL_DISTANCE_PX,
  ADD_DOCK_REVEAL_START_PX,
  clampProgress,
  EDITABLE_COLUMNS,
  getCellId,
  INVENTORY_TABLE_COLUMN_COUNT,
  INVENTORY_TABLE_HEADERS,
} from "./dishwareInventoryItemsTable/tableConstants";

export type DishwareInventoryTableItem = DishwareInventoryEditableItem;

type DishwareInventoryItemsTableProps = {
  includeSurplus?: boolean;
  items: DishwareInventoryTableItem[];
  uploadingClientId: string | null;
  readOnly?: boolean;
  saving?: boolean;
  photosLocked?: boolean;
  onAddItem: () => string;
  onChange: (clientId: string, patch: Partial<DishwareInventoryTableItem>) => void;
  onRemove: (clientId: string) => void;
  onPhotoEditingChange?: (editing: boolean) => void;
  onUploadImage: (clientId: string, file: File, originalFile?: File) => Promise<boolean | void>;
  onDeleteImage: (clientId: string) => void;
};

export default function DishwareInventoryItemsTable({
  items,
  includeSurplus = false,
  uploadingClientId,
  readOnly = false,
  saving = false,
  photosLocked = false,
  onAddItem,
  onChange,
  onRemove,
  onUploadImage,
  onDeleteImage,
  onPhotoEditingChange,
}: DishwareInventoryItemsTableProps) {
  const [mobile, setMobile] = useState(() => window.matchMedia("(max-width: 639px)").matches);
  useEffect(() => {
    const query = window.matchMedia("(max-width: 639px)");
    const update = () => setMobile(query.matches);
    query.addEventListener("change", update);
    return () => query.removeEventListener("change", update);
  }, []);
  const photos = useDishwarePhotoDialogs({
    items,
    readOnly,
    locked: photosLocked || saving,
    onUpload: onUploadImage,
    onDelete: onDeleteImage,
    onEditingChange: onPhotoEditingChange,
  });
  const [removeItemId, setRemoveItemId] = useState<string | null>(null);
  const requestRemove = (clientId: string) => setRemoveItemId(clientId);
  useEffect(() => {
    if (readOnly) setRemoveItemId(null);
  }, [readOnly]);
  const [noteItemId, setNoteItemId] = useState<string | null>(null);
  const [openPhotoMenuItemId, setOpenPhotoMenuItemId] = useState<string | null>(null);
  const [addDockProgress, setAddDockProgress] = useState(0);
  const [pendingFocusCellId, setPendingFocusCellId] = useState<string | null>(null);
  const topAddButtonRef = useRef<HTMLDivElement | null>(null);
  const noteItem = useMemo(() => items.find((item) => item.clientId === noteItemId) ?? null, [items, noteItemId]);
  const navigation = useGridNavigation({
    rows: items,
    cols: EDITABLE_COLUMNS,
    getCellId,
    isCellEditable: () => !readOnly,
    wrapTab: true,
  });

  useEffect(() => {
    if (readOnly) {
      setAddDockProgress(0);
      return;
    }

    const addButton = topAddButtonRef.current;
    if (!addButton) return;

    let frameId: number | null = null;
    const reducedMotionQuery =
      typeof window.matchMedia === "function" ? window.matchMedia("(prefers-reduced-motion: reduce)") : null;

    const updateDockProgress = () => {
      frameId = null;
      const rect = addButton.getBoundingClientRect();
      const isWithinViewport = rect.bottom > 0 && rect.top < window.innerHeight;
      const hitX = rect.left + rect.width / 2;
      const hitY = rect.top + rect.height / 2;
      const hitTarget =
        isWithinViewport && hitX >= 0 && hitX <= window.innerWidth && hitY >= 0 && hitY <= window.innerHeight
          ? document.elementFromPoint(hitX, hitY)
          : null;
      const isCovered = Boolean(hitTarget && !addButton.contains(hitTarget));
      const nextProgress = isCovered
        ? 1
        : reducedMotionQuery?.matches
          ? Number(rect.bottom < 0)
          : clampProgress((ADD_DOCK_REVEAL_START_PX - rect.bottom) / ADD_DOCK_REVEAL_DISTANCE_PX);
      const roundedProgress = Math.round(nextProgress * 100) / 100;

      setAddDockProgress((currentProgress) =>
        Math.abs(currentProgress - roundedProgress) > 0.01 ? roundedProgress : currentProgress,
      );
    };

    const requestDockProgressUpdate = () => {
      if (frameId !== null) return;
      frameId = window.requestAnimationFrame(updateDockProgress);
    };

    requestDockProgressUpdate();
    window.addEventListener("scroll", requestDockProgressUpdate, { passive: true, capture: true });
    window.addEventListener("resize", requestDockProgressUpdate);
    reducedMotionQuery?.addEventListener("change", requestDockProgressUpdate);

    return () => {
      if (frameId !== null) {
        window.cancelAnimationFrame(frameId);
      }
      window.removeEventListener("scroll", requestDockProgressUpdate, { capture: true });
      window.removeEventListener("resize", requestDockProgressUpdate);
      reducedMotionQuery?.removeEventListener("change", requestDockProgressUpdate);
    };
  }, [readOnly]);

  useEffect(() => {
    if (!pendingFocusCellId) return;

    let scrollFrame: number | null = null;
    const frame = window.requestAnimationFrame(() => {
      navigation.focusCellById(pendingFocusCellId);
      scrollFrame = window.requestAnimationFrame(() => {
        const activeElement = document.activeElement;
        if (activeElement instanceof HTMLElement) {
          activeElement.scrollIntoView({ block: "center", inline: "nearest" });
        }
        setPendingFocusCellId(null);
      });
    });

    return () => {
      window.cancelAnimationFrame(frame);
      if (scrollFrame !== null) {
        window.cancelAnimationFrame(scrollFrame);
      }
    };
  }, [items.length, navigation, pendingFocusCellId]);

  const handleAddItem = useCallback(() => {
    if (readOnly || saving) return;

    const clientId = onAddItem();
    setPendingFocusCellId(`${clientId}:name`);
  }, [onAddItem, readOnly, saving]);

  return (
    <section className={cn("space-y-3", !readOnly && "pb-[3.25rem]")} aria-label="Позиции инвентаризации">
      <div className="flex items-center justify-between gap-2 sm:items-end">
        <div className="min-w-0">
          <h3 className="text-strong text-lg font-semibold sm:text-xl">Позиции</h3>
          <div className="text-muted text-[11px] sm:text-sm">Было / Приход / Стало</div>
        </div>
        {!readOnly ? (
          <div ref={topAddButtonRef} className="shrink-0">
            <Button
              size="sm"
              className="min-h-11 px-2 text-xs sm:px-3 sm:text-sm"
              disabled={saving}
              onClick={handleAddItem}
            >
              Добавить позицию
            </Button>
          </div>
        ) : null}
      </div>

      {photos.error && (
        <p role="alert" className="text-sm text-red-600">
          {photos.error}
        </p>
      )}
      {mobile ? (
        <ol className="space-y-2" aria-label="Мобильный подсчёт посуды">
          {!items.length && (
            <li className="text-muted rounded-2xl border border-dashed p-6 text-center text-sm">
              Позиции пока не добавлены.
            </li>
          )}
          {items.map((item, index) => (
            <MobileDishwareItem
              key={item.clientId}
              item={item}
              index={index}
              nextClientId={items[index + 1]?.clientId}
              includeSurplus={includeSurplus}
              readOnly={readOnly}
              photosLocked={photosLocked}
              uploading={uploadingClientId === item.clientId}
              navigation={navigation}
              onChange={onChange}
              onRemove={requestRemove}
              onUploadImage={photos.selectPhoto}
              onViewImage={photos.viewPhoto}
              onDeleteImage={onDeleteImage}
              onOpenNote={setNoteItemId}
            />
          ))}
        </ol>
      ) : (
        <div className="border-subtle bg-surface overflow-hidden rounded-[1.5rem] border shadow-[var(--staffly-shadow)]">
          <div
            className="overflow-auto"
            onScroll={() => {
              if (openPhotoMenuItemId) {
                setOpenPhotoMenuItemId(null);
              }
            }}
          >
            <table className="w-full min-w-[1308px] table-fixed border-separate border-spacing-0 text-sm">
              <thead>
                <tr className="text-left">
                  {INVENTORY_TABLE_HEADERS.map((header) => (
                    <th key={header.label} className={header.className}>
                      {header.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {items.length === 0 ? (
                  <tr>
                    <td colSpan={INVENTORY_TABLE_COLUMN_COUNT} className="text-muted px-4 py-8 text-center text-sm">
                      Позиции пока не добавлены.
                    </td>
                  </tr>
                ) : null}

                {items.map((item, rowIndex) => (
                  <DishwareInventoryItemRow
                    includeSurplus={includeSurplus}
                    key={item.clientId}
                    item={item}
                    rowIndex={rowIndex}
                    uploading={uploadingClientId === item.clientId}
                    readOnly={readOnly}
                    photosLocked={photosLocked}
                    photoMenuOpen={openPhotoMenuItemId === item.clientId}
                    navigation={navigation}
                    onChange={onChange}
                    onRemove={requestRemove}
                    onPhotoMenuOpenChange={(open) => setOpenPhotoMenuItemId(open ? item.clientId : null)}
                    onUploadImage={photos.selectPhoto}
                    onViewImage={photos.viewPhoto}
                    onDeleteImage={onDeleteImage}
                    onOpenNote={setNoteItemId}
                  />
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
      {photos.dialogs}

      {!readOnly ? <FloatingAddButton progress={addDockProgress} saving={saving} onClick={handleAddItem} /> : null}

      <ConfirmDialog
        open={Boolean(removeItemId) && !readOnly}
        title="Удалить позицию?"
        description="Данная позиция навсегда будет удалена."
        confirmText="Удалить"
        tone="danger"
        onCancel={() => setRemoveItemId(null)}
        onConfirm={() => {
          if (removeItemId && !readOnly) onRemove(removeItemId);
          setRemoveItemId(null);
        }}
      />
      <NoteModal item={noteItem} readOnly={readOnly} onClose={() => setNoteItemId(null)} onChange={onChange} />
    </section>
  );
}
