import type { GridNavigationHandlers } from "../../../../shared/ui/gridNavigation/gridNavigationTypes";
import { cn } from "../../../../shared/lib/cn";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";
import {
  computeDishwareItemMetrics,
  formatCompactInventoryMoney,
  formatDishwareCountInputValue,
  formatDishwareMoneyInputValue,
  formatInventoryLossAmount,
  parseDishwareCountInput,
  parseDishwareMoneyInput,
} from "../../utils";
import InfoCell from "./InfoCell";
import NumericCell from "./NumericCell";
import PhotoCell from "./PhotoCell";
import { cellInputClassName, EDITABLE_COLUMNS, getCellId } from "./tableConstants";

type QuantityField = "previousQty" | "incomingQty" | "currentQty";

type QuantityColumnConfig = {
  field: QuantityField;
  colIndex: 1 | 2 | 3;
};

const quantityColumns: QuantityColumnConfig[] = [
  { field: "previousQty", colIndex: 1 },
  { field: "incomingQty", colIndex: 2 },
  { field: "currentQty", colIndex: 3 },
];

type DishwareInventoryItemRowProps = {
  item: DishwareInventoryEditableItem;
  rowIndex: number;
  uploading: boolean;
  readOnly: boolean;
  photoMenuOpen: boolean;
  navigation: Pick<GridNavigationHandlers, "registerCellRef" | "onCellKeyDown">;
  onChange: (clientId: string, patch: Partial<DishwareInventoryEditableItem>) => void;
  onRemove: (clientId: string) => void;
  onPhotoMenuOpenChange: (open: boolean) => void;
  onUploadImage: (itemId: number, file: File) => void;
  onDeleteImage: (itemId: number) => void;
  onOpenNote: (clientId: string) => void;
};

export default function DishwareInventoryItemRow({
  item,
  rowIndex,
  uploading,
  readOnly,
  photoMenuOpen,
  navigation,
  onChange,
  onRemove,
  onPhotoMenuOpenChange,
  onUploadImage,
  onDeleteImage,
  onOpenNote,
}: DishwareInventoryItemRowProps) {
  const metrics = computeDishwareItemMetrics(item);

  return (
    <tr className="group">
      <td className="border-subtle bg-surface text-muted group-hover:bg-app sticky left-0 z-20 w-11 border-r border-b text-center align-middle text-xs font-semibold tabular-nums sm:w-12">
        {rowIndex + 1}
      </td>
      <td className="border-subtle bg-surface group-hover:bg-app sticky left-11 z-20 w-[88px] border-r border-b align-middle sm:left-12 sm:w-[96px]">
        <PhotoCell
          item={item}
          index={rowIndex}
          uploading={uploading}
          readOnly={readOnly}
          photoMenuOpen={photoMenuOpen}
          onPhotoMenuOpenChange={onPhotoMenuOpenChange}
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

      {quantityColumns.map(({ field, colIndex }) => (
        <td key={field} className="border-subtle group-hover:bg-app min-w-0 border-r border-b align-middle">
          <NumericCell
            inputMode="numeric"
            disabled={readOnly}
            value={item[field]}
            cellId={getCellId(item, EDITABLE_COLUMNS[colIndex])}
            rowIndex={rowIndex}
            colIndex={colIndex}
            registerCellRef={navigation.registerCellRef}
            onCellKeyDown={navigation.onCellKeyDown}
            formatValue={formatDishwareCountInputValue}
            parseValue={parseDishwareCountInput}
            onCommit={(value) => onChange(item.clientId, { [field]: value })}
          />
        </td>
      ))}

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
        <InfoCell item={item} index={rowIndex} readOnly={readOnly} onOpenNote={onOpenNote} onRemove={onRemove} />
      </td>
    </tr>
  );
}
