import { StickyNote, Trash2 } from "lucide-react";

import { cn } from "../../../../shared/lib/cn";
import Icon from "../../../../shared/ui/Icon";
import type { DishwareInventoryEditableItem } from "../../dishwareInventoryItems";
import {
  computeDishwareItemMetrics,
  formatCompactInventoryMoney,
  formatCompactInventoryNumber,
  formatInventoryCount,
  formatInventoryLossAmount,
  formatInventoryLossCount,
} from "../../utils";
import InfoPill from "./InfoPill";

type InfoCellProps = {
  item: DishwareInventoryEditableItem;
  index: number;
  readOnly: boolean;
  onOpenNote: (clientId: string) => void;
  onRemove: (clientId: string) => void;
};

export default function InfoCell({ item, index, readOnly, onOpenNote, onRemove }: InfoCellProps) {
  const metrics = computeDishwareItemMetrics(item);
  const hasNote = Boolean(item.note?.trim());
  const diffTone = metrics.diff < 0 ? "loss" : metrics.diff > 0 ? "gain" : "default";
  const diffTitle =
    metrics.diff < 0
      ? formatInventoryLossCount(metrics.diff)
      : metrics.diff > 0
        ? `+${formatInventoryCount(metrics.diff)}`
        : "0";
  const diffValue =
    metrics.diff < 0
      ? formatCompactInventoryNumber(metrics.diff)
      : metrics.diff > 0
        ? `+${formatCompactInventoryNumber(metrics.diff)}`
        : "0";
  const diffLabel = metrics.diff < 0 ? "недостача" : metrics.diff > 0 ? "излишек" : "ровно";

  return (
    <div className="flex min-h-14 min-w-0 flex-col justify-center gap-1 px-2 py-1.5">
      <div className="flex flex-wrap items-center gap-1.5">
        <InfoPill label={diffLabel} value={diffValue} tone={diffTone} title={`${diffLabel} ${diffTitle}`} />
        <InfoPill
          label="потери"
          value={formatCompactInventoryMoney(metrics.lossAmount)}
          tone={metrics.lossAmount > 0 ? "loss" : "default"}
          title={`потери ${formatInventoryLossAmount(metrics.lossAmount)}`}
        />
        <InfoPill
          label="ожид."
          value={formatCompactInventoryNumber(metrics.expectedQty)}
          title={`ожид. ${formatInventoryCount(metrics.expectedQty)}`}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={cn(
            "inline-flex min-h-11 min-w-0 items-center gap-1.5 rounded-lg px-2 text-xs font-medium transition outline-none focus:ring-2 focus:ring-[var(--staffly-ring)] sm:min-h-7",
            hasNote
              ? "text-default bg-[color:var(--staffly-control-hover)]"
              : "text-muted bg-[color:var(--staffly-control)]",
            readOnly && !hasNote ? "cursor-default opacity-70" : "hover:bg-[color:var(--staffly-control-hover)]",
          )}
          disabled={readOnly && !hasNote}
          onClick={() => onOpenNote(item.clientId)}
        >
          <Icon icon={StickyNote} size="xs" decorative className="shrink-0" />
          <span className="truncate">{hasNote ? "Есть заметка" : "Заметка"}</span>
        </button>

        {!readOnly ? (
          <button
            type="button"
            className="inline-flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-[color:var(--staffly-loss-text)] transition outline-none hover:bg-[color:var(--staffly-loss-bg)] focus:ring-2 focus:ring-[var(--staffly-loss-border)] sm:h-8 sm:w-8"
            aria-label={`Удалить позицию ${index + 1}`}
            title="Удалить позицию"
            onClick={() => onRemove(item.clientId)}
          >
            <Icon icon={Trash2} size="sm" decorative />
          </button>
        ) : null}
      </div>
    </div>
  );
}
