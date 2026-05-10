import { useCallback, useEffect, useMemo, useRef, useState } from "react";

import { cn } from "../../../shared/lib/cn";
import Button from "../../../shared/ui/Button";
import { useGridNavigation } from "../../../shared/ui/gridNavigation/useGridNavigation";
import type { DishwareInventoryEditableItem } from "../dishwareInventoryItems";
import {
  computeDishwareItemMetrics,
  formatCompactInventoryMoney,
  formatDishwareCountInputValue,
  formatDishwareMoneyInputValue,
  formatInventoryLossAmount,
  parseDishwareCountInput,
  parseDishwareMoneyInput,
} from "../utils";
import FloatingAddButton from "./dishwareInventoryItemsTable/FloatingAddButton";
import InfoCell from "./dishwareInventoryItemsTable/InfoCell";
import NoteModal from "./dishwareInventoryItemsTable/NoteModal";
import NumericCell from "./dishwareInventoryItemsTable/NumericCell";
import PhotoCell from "./dishwareInventoryItemsTable/PhotoCell";
import {
  ADD_DOCK_REVEAL_DISTANCE_PX,
  ADD_DOCK_REVEAL_START_PX,
  cellInputClassName,
  clampProgress,
  EDITABLE_COLUMNS,
  getCellId,
} from "./dishwareInventoryItemsTable/tableConstants";

export type DishwareInventoryTableItem = DishwareInventoryEditableItem;

type DishwareInventoryItemsTableProps = {
  items: DishwareInventoryTableItem[];
  uploadingItemId: number | null;
  readOnly?: boolean;
  saving?: boolean;
  onAddItem: () => string;
  onChange: (clientId: string, patch: Partial<DishwareInventoryTableItem>) => void;
  onRemove: (clientId: string) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
};

export default function DishwareInventoryItemsTable({
  items,
  uploadingItemId,
  readOnly = false,
  saving = false,
  onAddItem,
  onChange,
  onRemove,
  onUploadImage,
  onDeleteImage,
}: DishwareInventoryItemsTableProps) {
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
      const nextProgress = reducedMotionQuery?.matches
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
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div className="min-w-0">
          <h3 className="text-strong text-xl font-semibold">Позиции</h3>
          <div className="text-muted text-sm">Было / Приход / Стало</div>
        </div>
        {!readOnly ? (
          <div ref={topAddButtonRef} className="self-start sm:self-auto">
            <Button size="sm" className="min-h-11" disabled={saving} onClick={handleAddItem}>
              Добавить позицию
            </Button>
          </div>
        ) : null}
      </div>

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
                <th className="border-subtle bg-surface text-muted sticky top-0 left-0 z-40 w-11 border-r border-b px-2 py-2 text-center text-xs font-semibold sm:w-12">
                  №
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 left-11 z-40 w-[88px] border-r border-b px-2 py-2 text-xs font-semibold sm:left-12 sm:w-[96px] sm:px-3">
                  Фото
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 left-[132px] z-40 w-[168px] border-r border-b px-3 py-2 text-xs font-semibold sm:left-[144px] sm:w-[300px]">
                  Название
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Было
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Приход
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[128px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Стало
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[136px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Цена
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[180px] border-r border-b px-3 py-2 text-xs font-semibold">
                  Итог
                </th>
                <th className="border-subtle bg-surface text-muted sticky top-0 z-30 w-[322px] border-b px-3 py-2 text-xs font-semibold">
                  Краткая инфа
                </th>
              </tr>
            </thead>
            <tbody>
              {items.length === 0 ? (
                <tr>
                  <td colSpan={9} className="text-muted px-4 py-8 text-center text-sm">
                    Позиции пока не добавлены.
                  </td>
                </tr>
              ) : null}

              {items.map((item, rowIndex) => {
                const metrics = computeDishwareItemMetrics(item);

                return (
                  <tr key={item.clientId} className="group">
                    <td className="border-subtle bg-surface text-muted group-hover:bg-app sticky left-0 z-20 w-11 border-r border-b text-center align-middle text-xs font-semibold tabular-nums sm:w-12">
                      {rowIndex + 1}
                    </td>
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-11 z-20 w-[88px] border-r border-b align-middle sm:left-12 sm:w-[96px]">
                      <PhotoCell
                        item={item}
                        index={rowIndex}
                        uploading={uploadingItemId === item.id}
                        readOnly={readOnly}
                        photoMenuOpen={openPhotoMenuItemId === item.clientId}
                        onPhotoMenuOpenChange={(open) => setOpenPhotoMenuItemId(open ? item.clientId : null)}
                        onUploadImage={onUploadImage}
                        onDeleteImage={onDeleteImage}
                      />
                    </td>
                    <td className="border-subtle bg-surface group-hover:bg-app sticky left-[132px] z-20 w-[168px] border-r border-b align-middle sm:left-[144px] sm:w-[300px]">
                      <div className="flex min-h-[80px] min-w-0 items-center sm:min-h-[82px]">
                        <input
                          className={cn(cellInputClassName, "text-default font-medium")}
                          value={item.name}
                          disabled={readOnly}
                          placeholder="Название позиции"
                          ref={navigation.registerCellRef(getCellId(item, EDITABLE_COLUMNS[0]))}
                          onKeyDown={(event) =>
                            navigation.onCellKeyDown(event, {
                              rowIndex,
                              colIndex: 0,
                              cellId: getCellId(item, EDITABLE_COLUMNS[0]),
                            })
                          }
                          onChange={(event) => onChange(item.clientId, { name: event.target.value })}
                        />
                      </div>
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="numeric"
                        disabled={readOnly}
                        value={item.previousQty}
                        cellId={getCellId(item, EDITABLE_COLUMNS[1])}
                        rowIndex={rowIndex}
                        colIndex={1}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareCountInputValue}
                        parseValue={parseDishwareCountInput}
                        onCommit={(previousQty) => onChange(item.clientId, { previousQty })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="numeric"
                        disabled={readOnly}
                        value={item.incomingQty}
                        cellId={getCellId(item, EDITABLE_COLUMNS[2])}
                        rowIndex={rowIndex}
                        colIndex={2}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareCountInputValue}
                        parseValue={parseDishwareCountInput}
                        onCommit={(incomingQty) => onChange(item.clientId, { incomingQty })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="numeric"
                        disabled={readOnly}
                        value={item.currentQty}
                        cellId={getCellId(item, EDITABLE_COLUMNS[3])}
                        rowIndex={rowIndex}
                        colIndex={3}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareCountInputValue}
                        parseValue={parseDishwareCountInput}
                        onCommit={(currentQty) => onChange(item.clientId, { currentQty })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <NumericCell
                        inputMode="decimal"
                        disabled={readOnly}
                        placeholder="0,00"
                        value={item.unitPrice ?? null}
                        cellId={getCellId(item, EDITABLE_COLUMNS[4])}
                        rowIndex={rowIndex}
                        colIndex={4}
                        registerCellRef={navigation.registerCellRef}
                        onCellKeyDown={navigation.onCellKeyDown}
                        formatValue={formatDishwareMoneyInputValue}
                        parseValue={parseDishwareMoneyInput}
                        onCommit={(unitPrice) => onChange(item.clientId, { unitPrice })}
                      />
                    </td>
                    <td className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
                      <div
                        title={formatInventoryLossAmount(metrics.lossAmount)}
                        className={cn(
                          "mx-2 flex min-h-10 min-w-0 items-center justify-end overflow-hidden rounded-xl px-3 text-sm font-semibold whitespace-nowrap tabular-nums",
                          metrics.lossAmount > 0
                            ? "bg-[color:var(--staffly-loss-bg)] text-[color:var(--staffly-loss-text)]"
                            : "text-default",
                        )}
                      >
                        <span className="min-w-0 truncate">{formatCompactInventoryMoney(metrics.lossAmount)}</span>
                      </div>
                    </td>
                    <td className="border-subtle group-hover:bg-app border-b align-middle">
                      <InfoCell
                        item={item}
                        index={rowIndex}
                        readOnly={readOnly}
                        onOpenNote={setNoteItemId}
                        onRemove={onRemove}
                      />
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>

      {!readOnly ? <FloatingAddButton progress={addDockProgress} saving={saving} onClick={handleAddItem} /> : null}

      <NoteModal item={noteItem} readOnly={readOnly} onClose={() => setNoteItemId(null)} onChange={onChange} />
    </section>
  );
}
