import Card from "../../../shared/ui/Card";
import {
  formatInventoryCount,
  formatInventoryLossAmount,
  formatInventoryLossCount,
  type DishwareInventorySummary,
} from "../utils";

type DishwareInventorySummaryProps = {
  summary: DishwareInventorySummary;
};

export default function DishwareInventorySummary({ summary }: DishwareInventorySummaryProps) {
  const hasLoss = summary.lossQty > 0;
  const hasGain = summary.gainQty > 0;
  const metrics = [
    {
      label: "Позиций",
      value: formatInventoryCount(summary.itemCount),
      className: "text-default",
    },
    {
      label: "Недостача",
      value: formatInventoryLossCount(summary.lossQty),
      className: hasLoss ? "text-rose-600" : "text-default",
    },
    {
      label: "Излишек",
      value: hasGain ? `+${formatInventoryCount(summary.gainQty)}` : "0",
      className: hasGain ? "text-emerald-700" : "text-default",
    },
    {
      label: "Потери",
      value: formatInventoryLossAmount(summary.totalLossAmount),
      className: summary.totalLossAmount > 0 ? "text-rose-600" : "text-default",
    },
  ];

  return (
    <Card className="sticky top-2 z-10 border-[color:var(--staffly-border)] bg-[color:var(--staffly-surface)]/95 px-3 py-2 backdrop-blur">
      <dl className="grid grid-cols-2 gap-2 lg:grid-cols-4">
        {metrics.map((metric) => (
          <div
            key={metric.label}
            className="border-subtle flex min-h-12 items-center justify-between gap-3 rounded-xl border bg-[color:var(--staffly-control)]/40 px-3 py-2"
          >
            <dt className="text-muted text-[11px] font-medium">{metric.label}</dt>
            <dd className={`text-base font-semibold tabular-nums ${metric.className}`}>{metric.value}</dd>
          </div>
        ))}
      </dl>
      <div className="text-muted mt-1.5 flex flex-wrap items-center gap-x-4 gap-y-1 text-xs">
        <span>Было: {formatInventoryCount(summary.previousQty)}</span>
        <span>Докупили: {formatInventoryCount(summary.incomingQty)}</span>
        <span>Ожидалось: {formatInventoryCount(summary.expectedQty)}</span>
        <span>Стало: {formatInventoryCount(summary.currentQty)}</span>
        <span>Позиции с недостачей: {formatInventoryCount(summary.positionsWithLoss)}</span>
      </div>
    </Card>
  );
}
