import Card from "../../../shared/ui/Card";
import { formatInventoryCount, formatInventoryLossAmount, formatInventoryLossCount, type DishwareInventorySummary } from "../utils";

type DishwareInventorySummaryProps = {
  summary: DishwareInventorySummary;
};

export default function DishwareInventorySummary({ summary }: DishwareInventorySummaryProps) {
  const hasLoss = summary.lossQty > 0;

  return (
    <Card className="sticky top-2 z-10 border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/95 p-3 backdrop-blur">
      <div className="mb-3 rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/35 px-3 py-2 text-xs leading-5 text-muted">
        <span className="font-medium text-default">Коротко:</span> ожидаемое количество = было + докупили. Недостача показывает только расхождение
        с фактом.
      </div>

      <dl className="grid grid-cols-2 gap-2 sm:grid-cols-3 xl:grid-cols-6">
        <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
          <dt className="text-[11px] font-medium text-muted">Позиций</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-default">{formatInventoryCount(summary.itemCount)}</dd>
        </div>
        <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
          <dt className="text-[11px] font-medium text-muted">Было</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-default">{formatInventoryCount(summary.previousQty)}</dd>
        </div>
        <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
          <dt className="text-[11px] font-medium text-muted">Докупили</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-default">{formatInventoryCount(summary.incomingQty)}</dd>
        </div>
        <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
          <dt className="text-[11px] font-medium text-muted">Ожидалось</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-default">{formatInventoryCount(summary.expectedQty)}</dd>
        </div>
        <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
          <dt className="text-[11px] font-medium text-muted">Стало</dt>
          <dd className="mt-1 text-lg font-semibold tabular-nums text-default">{formatInventoryCount(summary.currentQty)}</dd>
        </div>
        <div className="rounded-2xl border border-subtle bg-[color:var(--staffly-control)]/45 px-3 py-2">
          <dt className="text-[11px] font-medium text-muted">Недостача, шт</dt>
          <dd className={`mt-1 text-lg font-semibold tabular-nums ${hasLoss ? "text-rose-600" : "text-default"}`}>
            {formatInventoryLossCount(summary.lossQty)}
          </dd>
        </div>
      </dl>
      <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted">
        <span>Позиции с недостачей: {formatInventoryCount(summary.positionsWithLoss)}</span>
        <span>Излишек: {summary.gainQty > 0 ? `+${formatInventoryCount(summary.gainQty)} шт` : "0"}</span>
        <span>Сумма потерь: {formatInventoryLossAmount(summary.totalLossAmount)}</span>
      </div>
    </Card>
  );
}
